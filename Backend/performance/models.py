
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


def default_token_expiry():

    return timezone.now() + timedelta(hours=24)


class TimeStampedModel(models.Model):

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Employer(TimeStampedModel):

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employer_profile",
    )
    fio = models.CharField(max_length=255)
    birthday = models.DateField(null=True, blank=True)
    email = models.EmailField(unique=True)
    date_of_employment = models.DateField()
    activation_date = models.DateField(null=True, blank=True)
    date_of_dismissal = models.DateField(null=True, blank=True)
    position = models.CharField(max_length=255)

    class Meta:
        ordering = ["fio"]

    def __str__(self) -> str:
        return f"{self.fio} ({self.position})"

    @property
    def is_active(self) -> bool:
        current_date = timezone.now().date()
        return self.date_of_dismissal is None or self.date_of_dismissal > current_date


class ReviewPeriod(TimeStampedModel):

    month_period = models.PositiveIntegerField(help_text="Number of months since the employment date")
    name = models.CharField(max_length=100, default="", blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["month_period"]
        unique_together = ("month_period", "name")

    def __str__(self) -> str:
        suffix = self.name or f"{self.month_period}m"
        return f"ReviewPeriod {suffix}"


class SkillCategory(TimeStampedModel):

    HARD = "hard"
    SOFT = "soft"
    SKILL_TYPES = (
        (HARD, "Hard skill"),
        (SOFT, "Soft skill"),
    )

    skill_type = models.CharField(max_length=10, choices=SKILL_TYPES)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)

    class Meta:
        unique_together = ("skill_type", "name")
        ordering = ["skill_type", "name"]

    def __str__(self) -> str:
        return f"{self.get_skill_type_display()}: {self.name}"


class SkillQuestion(TimeStampedModel):

    class Context(models.TextChoices):
        SELF = "self", "Самооценка"
        PEER = "peer", "Оценка 360"
        BOTH = "both", "Самооценка и 360"

    class AnswerType(models.TextChoices):
        SCALE = "scale", "Шкала"
        NUMERIC = "numeric", "Числовой ответ"
        SINGLE_CHOICE = "single_choice", "Один вариант"
        BOOLEAN = "boolean", "Да/Нет"

    category = models.ForeignKey(SkillCategory, on_delete=models.CASCADE, related_name="questions")
    question_text = models.TextField()
    grade_description = models.TextField()
    weight = models.PositiveIntegerField(default=1, help_text="Weight multiplier for aggregated scores")
    is_active = models.BooleanField(default=True)
    context = models.CharField(max_length=10, choices=Context.choices, default=Context.BOTH)
    answer_type = models.CharField(max_length=20, choices=AnswerType.choices, default=AnswerType.SCALE)
    scale_min = models.PositiveSmallIntegerField(default=0)
    scale_max = models.PositiveSmallIntegerField(default=10)
    answer_options = models.JSONField(default=list, blank=True)
    correct_answer = models.JSONField(null=True, blank=True)
    difficulty = models.CharField(max_length=32, blank=True, default="")
    tolerance = models.FloatField(default=0)
    departments = models.ManyToManyField(
        "api.Department",
        blank=True,
        related_name="skill_questions",
        help_text="Если не выбрано ни одного отдела, вопрос доступен для всех",
    )

    class Meta:
        ordering = ["category", "created_at"]

    def __str__(self) -> str:
        dept_names = list(self.departments.values_list("name", flat=True)[:3]) if self.pk else []
        scope = "общий" if not dept_names else ", ".join(dept_names)
        return f"{self.category.name} • {scope}: {self.question_text[:80]}"


class ReviewLog(TimeStampedModel):

    STATUS_PENDING = "pending"
    STATUS_COMPLETED = "completed"
    STATUS_EXPIRED = "expired"
    STATUS_PENDING_EMAIL = "pending_email"
    STATUS_AWAITING_FEEDBACK = "awaiting_feedback"

    CONTEXT_SKILL = "skill"
    CONTEXT_TASK = "task"
    CONTEXT_GOAL = "goal"
    CONTEXT_CHOICES = (
        (CONTEXT_SKILL, "Skill review"),
        (CONTEXT_TASK, "Task review"),
        (CONTEXT_GOAL, "Goal review"),
    )

    employer = models.ForeignKey(
        Employer,
        on_delete=models.CASCADE,
        related_name="review_logs",
        help_text="Employee under assessment",
    )
    respondent = models.ForeignKey(
        Employer,
        on_delete=models.CASCADE,
        related_name="assigned_reviews",
        help_text="Reviewer who provides feedback",
    )
    period = models.ForeignKey(
        "ReviewPeriod",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs",
    )
    context = models.CharField(max_length=10, choices=CONTEXT_CHOICES, default=CONTEXT_SKILL)
    question_type = models.CharField(max_length=10, blank=True)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    expires_at = models.DateTimeField(default=default_token_expiry)
    status = models.CharField(
        max_length=20,
        choices=(
            (STATUS_PENDING, "Pending"),
            (STATUS_COMPLETED, "Completed"),
            (STATUS_EXPIRED, "Expired"),
            (STATUS_PENDING_EMAIL, "Pending email"),
            (STATUS_AWAITING_FEEDBACK, "Awaiting feedback"),
        ),
        default=STATUS_PENDING,
    )
    email_sent = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["context", "status"], name="perf_revlog_ctx_status_idx"),
            models.Index(fields=["token"], name="perf_revlog_token_idx"),
        ]

    def mark_expired(self) -> None:
        if self.status == self.STATUS_COMPLETED:
            return
        if timezone.now() >= self.expires_at:
            self.status = self.STATUS_EXPIRED
            self.save(update_fields=["status", "updated_at"])


class ReviewAnswer(TimeStampedModel):

    employer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="answers_as_employee")
    respondent = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="answers_as_respondent")
    period = models.ForeignKey(ReviewPeriod, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(SkillQuestion, on_delete=models.CASCADE, related_name="answers")
    question_type = models.CharField(max_length=10, choices=SkillCategory.SKILL_TYPES)
    grade = models.PositiveSmallIntegerField(default=0)
    answer_value = models.JSONField(default=dict, blank=True)
    is_correct = models.BooleanField(null=True, blank=True)

    class Meta:
        unique_together = ("employer", "respondent", "period", "question")
        indexes = [
            models.Index(fields=["employer", "period"], name="perf_answ_emp_period_idx"),
            models.Index(fields=["respondent", "period"], name="perf_answ_resp_period_idx"),
        ]

    @property
    def is_self_review(self) -> bool:
        return self.employer_id == self.respondent_id


class ReviewQuestion(TimeStampedModel):

    CONTEXT_CHOICES = (
        (ReviewLog.CONTEXT_TASK, "Task"),
        (ReviewLog.CONTEXT_GOAL, "Goal"),
        (ReviewLog.CONTEXT_SKILL, "Skill"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    context = models.CharField(max_length=10, choices=CONTEXT_CHOICES)
    role = models.CharField(max_length=120, blank=True)
    category = models.CharField(max_length=150)
    question_text = models.TextField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["context", "category", "question_text"]


class ReviewGoal(TimeStampedModel):

    STATUS_CHOICES = (
        ("active", "Active"),
        ("review", "In review"),
        ("done", "Done"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    employer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="goals")
    creator = models.ForeignKey(Employer, on_delete=models.SET_NULL, null=True, related_name="created_goals")
    deadline = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

    class Meta:
        ordering = ["-created_at"]


class ReviewTask(TimeStampedModel):

    STATUS_CHOICES = (
        ("active", "Active"),
        ("review", "In review"),
        ("completed", "Completed"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    goal = models.ForeignKey(ReviewGoal, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    priority = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-end_date", "title"]


class ReviewSchedule(TimeStampedModel):

    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("in_progress", "In progress"),
        ("completed", "Completed"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    context = models.CharField(max_length=10, choices=ReviewLog.CONTEXT_CHOICES)
    related_task = models.ForeignKey(
        ReviewTask,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="schedules",
    )
    related_goal = models.ForeignKey(
        ReviewGoal,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="schedules",
    )
    review_start = models.DateField()
    review_end = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    class Meta:
        ordering = ["review_start"]


class TaskReviewAnswer(TimeStampedModel):

    task = models.ForeignKey(ReviewTask, on_delete=models.CASCADE, related_name="answers")
    employer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="task_reviews_as_employee")
    respondent = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="task_reviews_as_respondent")
    question = models.ForeignKey(ReviewQuestion, on_delete=models.CASCADE, related_name="task_answers")
    grade = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = ("task", "employer", "respondent", "question")
        indexes = [
            models.Index(fields=["task", "respondent"], name="perf_task_answ_resp_idx"),
            models.Index(fields=["task", "employer"], name="perf_task_answ_emp_idx"),
        ]


class TeamRelation(TimeStampedModel):

    employer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="team_memberships")
    peer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="peer_memberships")

    class Meta:
        unique_together = ("employer", "peer")
        indexes = [
            models.Index(fields=["employer"], name="perf_team_rel_emp_idx"),
        ]


class SiteNotification(TimeStampedModel):

    CONTEXT_GENERAL = "general"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=255)
    message = models.TextField()
    context = models.CharField(
        max_length=20,
        choices=ReviewLog.CONTEXT_CHOICES + ((CONTEXT_GENERAL, "General"),),
        default=CONTEXT_GENERAL,
    )
    link = models.CharField(max_length=500, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    related_log = models.ForeignKey(
        ReviewLog,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"], name="perf_notif_recipient_idx"),
            models.Index(fields=["context"], name="perf_notif_context_idx"),
        ]

    def mark_read(self) -> None:
        if self.is_read:
            return
        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=["is_read", "read_at", "updated_at"])


class SkillReviewFeedback(TimeStampedModel):

    log = models.OneToOneField(
        ReviewLog,
        on_delete=models.CASCADE,
        related_name="feedback",
        help_text="Skill review log awaiting manager response",
    )
    author = models.ForeignKey(
        Employer,
        on_delete=models.CASCADE,
        related_name="skill_feedbacks",
    )
    message = models.TextField()
    shared_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def mark_shared(self) -> None:
        self.shared_at = timezone.now()
        self.save(update_fields=["shared_at", "updated_at"])
