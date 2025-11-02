from django.db import models
from django.contrib.auth.models import User


class DepartmentPosition(models.Model):
    department = models.ForeignKey('Department', on_delete=models.CASCADE, related_name='positions')
    title = models.CharField(max_length=200)
    importance = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['importance', 'id']
        unique_together = ['department', 'title']

    def __str__(self):
        return f"{self.department.name} • {self.title}"

class Department(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    def __str__(self):
        return self.name

class Employee(models.Model):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Суперпользователь'
        MANAGER = 'manager', 'Менеджер'
        BUSINESS_PARTNER = 'business_partner', 'Бизнес-партнер'
        EMPLOYEE = 'employee', 'Сотрудник'

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True)
    position_title = models.CharField(max_length=200, blank=True)
    position = models.ForeignKey(
        DepartmentPosition,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )
    role = models.CharField(
        max_length=32,
        choices=Role.choices,
        default=Role.EMPLOYEE
    )
    is_manager = models.BooleanField(default=False)
    hire_date = models.DateField()
    
    def __str__(self):
        position_label = self.position.title if self.position else self.position_title or '—'
        return f"{self.user.get_full_name()} - {position_label}"

    def save(self, *args, **kwargs):
        if self.is_manager and self.role != self.Role.MANAGER:
            self.role = self.Role.MANAGER

        if self.user and self.user.is_superuser and self.role != self.Role.ADMIN:
            self.role = self.Role.ADMIN

        if self.role == self.Role.MANAGER:
            self.is_manager = True
        else:
            self.is_manager = False

        if self.position and not self.position_title:
            self.position_title = self.position.title
        super().save(*args, **kwargs)

class Goal(models.Model):
    GOAL_TYPES = [
        ('strategic', 'Стратегическая цель'),
        ('tactical', 'Тактическая задача'),
        ('personal', 'Личное развитие'),
    ]
    
    CREATOR_TYPES = [
        ('self', 'Сотрудник'),
        ('manager', 'Руководитель'),
    ]
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='goals')
    created_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, related_name='created_goals')
    creator_type = models.CharField(max_length=20, choices=CREATOR_TYPES, default='self')
    title = models.CharField(max_length=300)
    description = models.TextField()
    goal_type = models.CharField(max_length=20, choices=GOAL_TYPES)
    start_date = models.DateField()
    end_date = models.DateField()
    expected_results = models.TextField()
    task_link = models.URLField(blank=True)
    requires_evaluation = models.BooleanField(default=False)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    evaluation_launched = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    participants = models.ManyToManyField(
        Employee,
        through='GoalParticipant',
        related_name='shared_goals'
    )
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        owner_name = self.employee.user.get_full_name() if self.employee_id else 'группа'
        return f"{self.title} - {owner_name}"

class Task(models.Model):
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=300)
    description = models.TextField()
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks_completed'
    )
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return self.title


class GoalParticipant(models.Model):
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='goal_participants')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='goal_participants')
    is_owner = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['goal', 'employee']
        ordering = ['joined_at']

    def __str__(self):
        return f"{self.goal.title} ↔ {self.employee.user.get_full_name()}"

class SelfAssessment(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE)
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='self_assessments')
    
    achieved_results = models.TextField()
    personal_contribution = models.TextField()
    skills_acquired = models.TextField()
    improvements_needed = models.TextField()
    collaboration_quality = models.IntegerField(choices=[(i, i) for i in range(11)])
    satisfaction_score = models.IntegerField(choices=[(i, i) for i in range(11)])
    
    calculated_score = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['employee', 'goal']

class Feedback360(models.Model):
    assessor = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='given_feedbacks')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='received_feedbacks')
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='feedbacks')
    
    results_achievement = models.IntegerField(choices=[(i, i) for i in range(11)])
    personal_qualities = models.TextField()
    collaboration_quality = models.IntegerField(choices=[(i, i) for i in range(11)])
    improvements_suggested = models.TextField()
    
    calculated_score = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['assessor', 'employee', 'goal']

class ManagerReview(models.Model):
    manager = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='given_reviews')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='received_reviews')
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='manager_reviews')
    
    results_achievement = models.IntegerField(choices=[(i, i) for i in range(11)])
    personal_qualities_feedback = models.TextField()
    personal_contribution_feedback = models.TextField()
    collaboration_quality = models.IntegerField(choices=[(i, i) for i in range(11)])
    improvements_recommended = models.TextField()
    overall_rating = models.IntegerField(choices=[(i, i) for i in range(11)])
    
    calculated_score = models.IntegerField(default=0)
    feedback_summary = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['manager', 'employee', 'goal']

class PotentialAssessment(models.Model):
    manager = models.ForeignKey(Employee, on_delete=models.CASCADE)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='potential_assessments')
    
    professional_qualities = models.JSONField(default=list)
    
    personal_qualities = models.JSONField(default=list)
    
    needed_motivation = models.BooleanField(default=False)
    communication_issues = models.BooleanField(default=False)
    
    DEVELOPMENT_DESIRE_CHOICES = [
        ('proactive', 'Да, хочет развиваться и проактивно себя ведет'),
        ('needs_help', 'Да, хочет развиваться, но нужна помощь менеджера/HR'),
        ('unsure', 'Не уверен, что есть желание развиваться'),
        ('no_desire', 'Не хочет'),
    ]
    development_desire = models.CharField(max_length=20, choices=DEVELOPMENT_DESIRE_CHOICES)
    
    is_successor = models.BooleanField(default=False)
    
    READINESS_CHOICES = [
        ('1-2', 'через 1-2 года'),
        ('3', 'через 3 года'),
        ('3+', 'через 3 и более лет'),
    ]
    successor_readiness = models.CharField(max_length=3, choices=READINESS_CHOICES, blank=True)
    
    retention_risk = models.IntegerField(choices=[(i, i) for i in range(11)])
    
    performance_score = models.IntegerField(default=0)
    potential_score = models.IntegerField(default=0)
    
    nine_box_x = models.IntegerField(null=True, blank=True)
    nine_box_y = models.IntegerField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

class GoalEvaluationNotification(models.Model):
    recipient = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='evaluation_notifications')
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='evaluation_notifications')
    is_read = models.BooleanField(default=False)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['recipient', 'goal']
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Notification for {self.recipient.user.get_full_name()} to evaluate {self.goal.title}"

class FinalReview(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE)
    review_period = models.CharField(max_length=50)  # Например: "1 полугодие 2025"
    
    self_assessment_score = models.IntegerField(default=0)
    feedback_360_score = models.IntegerField(default=0)
    manager_review_score = models.IntegerField(default=0)
    potential_score = models.IntegerField(default=0)
    
    total_score = models.IntegerField(default=0)
    
    SALARY_RECOMMENDATION_CHOICES = [
        ('exclude', 'Не включать в salary increase'),
        ('conditional', 'Включить при наличии критериев'),
        ('include', 'Включить в salary increase'),
    ]
    salary_recommendation = models.CharField(max_length=20, choices=SALARY_RECOMMENDATION_CHOICES)
    
    development_plan = models.TextField()
    manager_summary = models.TextField()
    
    created_at = models.DateTimeField(auto_now_add=True)