"""Data models for the Performance Review domain."""

import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


def default_token_expiry():
    """Provide a default expiration timestamp for one-time review links."""

    return timezone.now() + timedelta(hours=24)


class TimeStampedModel(models.Model):
    """Abstract base model that adds created/updated timestamps."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Employer(TimeStampedModel):
    """Stores the core profile data for each employee under review."""

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
    date_of_dismissal = models.DateField(null=True, blank=True)
    position = models.CharField(max_length=255)

    class Meta:
        ordering = ["fio"]

    def __str__(self) -> str:  # pragma: no cover - human readable output only
        return f"{self.fio} ({self.position})"

    @property
    def is_active(self) -> bool:
        current_date = timezone.now().date()
        return self.date_of_dismissal is None or self.date_of_dismissal > current_date


class ReviewPeriod(TimeStampedModel):
    """Represents a predefined review checkpoint in months with optional date window."""

    month_period = models.PositiveIntegerField(help_text="Number of months since the employment date")
    name = models.CharField(max_length=100, default="", blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["month_period"]
        unique_together = ("month_period", "name")

    def __str__(self) -> str:  # pragma: no cover
        suffix = self.name or f"{self.month_period}m"
        return f"ReviewPeriod {suffix}"


class SkillCategory(TimeStampedModel):
    """Hard or soft skill category grouping review questions."""

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

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.get_skill_type_display()}: {self.name}"


class SkillQuestion(TimeStampedModel):
    """Individual review question bound to a hard/soft skill category."""

    category = models.ForeignKey(SkillCategory, on_delete=models.CASCADE, related_name="questions")
    question_text = models.TextField()
    grade_description = models.TextField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["category", "created_at"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.category.name}: {self.question_text[:80]}"


class ReviewLog(TimeStampedModel):
    """Audit trail for review invitations and token-based survey access."""

    STATUS_PENDING = "pending"
    STATUS_COMPLETED = "completed"
    STATUS_EXPIRED = "expired"
    STATUS_PENDING_EMAIL = "pending_email"

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
        ),
        default=STATUS_PENDING,
    )
    email_sent = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["context", "status"]),
            models.Index(fields=["token"]),
        ]

    def mark_expired(self) -> None:
        if self.status == self.STATUS_COMPLETED:
            return
        if timezone.now() >= self.expires_at:
            self.status = self.STATUS_EXPIRED
            self.save(update_fields=["status", "updated_at"])


class ReviewAnswer(TimeStampedModel):
    """Centralised storage of answers for self and peer skill reviews."""

    employer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="answers_as_employee")
    respondent = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="answers_as_respondent")
    period = models.ForeignKey(ReviewPeriod, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(SkillQuestion, on_delete=models.CASCADE, related_name="answers")
    question_type = models.CharField(max_length=10, choices=SkillCategory.SKILL_TYPES)
    grade = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = ("employer", "respondent", "period", "question")
        indexes = [
            models.Index(fields=["employer", "period"]),
            models.Index(fields=["respondent", "period"]),
        ]

    @property
    def is_self_review(self) -> bool:
        return self.employer_id == self.respondent_id


class ReviewQuestion(TimeStampedModel):
    """Generic question bank used for task/goal review contexts."""

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
    """Strategic goal that groups individual tasks for an employer."""

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
    """Atomic task linked to a goal and used as a review trigger."""

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
    """Holds planned review windows for tasks, goals or skills."""

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
    """Stores self and peer answers for task/goal review questionnaires."""

    task = models.ForeignKey(ReviewTask, on_delete=models.CASCADE, related_name="answers")
    employer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="task_reviews_as_employee")
    respondent = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="task_reviews_as_respondent")
    question = models.ForeignKey(ReviewQuestion, on_delete=models.CASCADE, related_name="task_answers")
    grade = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = ("task", "employer", "respondent", "question")
        indexes = [
            models.Index(fields=["task", "respondent"]),
            models.Index(fields=["task", "employer"]),
        ]


class TeamRelation(TimeStampedModel):
    """Defines peer relationships used to assign reviewers for task cycles."""

    employer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="team_memberships")
    peer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="peer_memberships")

    class Meta:
        unique_together = ("employer", "peer")
        indexes = [models.Index(fields=["employer"])]
