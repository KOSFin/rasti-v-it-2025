import uuid

from django.db import models
from django.contrib.auth.models import User


class Organization(models.Model):
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


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
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='departments',
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
    )
    
    def __str__(self):
        return self.name


class Team(models.Model):
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='teams',
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subteams',
    )

    class Meta:
        ordering = ['department__name', 'name']
        unique_together = ['department', 'name']

    def __str__(self) -> str:
        return f"{self.department.name} • {self.name}"


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
    team = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='members',
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
        team_label = f" • {self.team.name}" if self.team_id else ''
        return f"{self.user.get_full_name()} - {position_label}{team_label}"

    def save(self, *args, **kwargs):
        if self.user and self.user.is_superuser:
            self.role = self.Role.ADMIN

        if self.team and self.department and self.team.department_id != self.department_id:
            self.team = None

        if self.position and not self.position_title:
            self.position_title = self.position.title

        super().save(*args, **kwargs)
        if self.pk:
            self.sync_role_from_assignments(commit=True)

    def organization(self):
        if self.department and self.department.organization:
            return self.department.organization
        return None

    def active_role_assignments(self):
        return self.role_assignments.filter(is_active=True, revoked_at__isnull=True)

    def has_global_visibility(self) -> bool:
        if self.user and self.user.is_superuser:
            return True
        if self.role in {self.Role.ADMIN, self.Role.BUSINESS_PARTNER}:
            return True
        assignments = self.active_role_assignments()
        return assignments.filter(role__in=EmployeeRoleAssignment.Role.global_roles()).exists()

    @property
    def has_leadership_scope(self) -> bool:
        if self.user and self.user.is_superuser:
            return True
        if self.role in {self.Role.ADMIN, self.Role.BUSINESS_PARTNER}:
            return True
        return self.active_role_assignments().filter(
            role__in=EmployeeRoleAssignment.Role.leadership_roles()
        ).exists()

    def visible_employee_ids(self, include_self: bool = True) -> set[int]:
        qs = Employee.objects.all()
        if self.has_global_visibility():
            return set(qs.values_list('id', flat=True))

        visible_ids = set()
        if include_self and self.pk:
            visible_ids.add(self.pk)

        assignments = list(self.active_role_assignments())
        for assignment in assignments:
            visible_ids.update(assignment.visible_employee_ids())

        return visible_ids

    def managed_employee_ids(self) -> set[int]:
        managed = set()
        if self.has_global_visibility():
            managed.update(
                Employee.objects.exclude(pk=self.pk).values_list('id', flat=True)
            )
        assignments = self.active_role_assignments()
        for assignment in assignments:
            managed.update(assignment.visible_employee_ids())
        managed.discard(self.pk)
        return managed

    def managed_employee_ids(self) -> set[int]:
        if self.has_global_visibility():
            return set(
                Employee.objects.exclude(pk=self.pk).values_list('id', flat=True)
            )

        managed_ids: set[int] = set()
        for assignment in self.active_role_assignments().filter(
            role__in=EmployeeRoleAssignment.Role.leadership_roles()
        ):
            managed_ids.update(assignment.visible_employee_ids())

        managed_ids.discard(self.pk)
        return managed_ids

    def can_manage_employee(self, other: 'Employee | None') -> bool:
        if other is None or not self.pk:
            return False
        if self.user and self.user.is_superuser:
            return True
        if self.role == self.Role.ADMIN:
            return True
        if self.role == self.Role.BUSINESS_PARTNER:
            return True
        if other.pk == self.pk:
            return True
        return other.pk in self.managed_employee_ids()

    def sync_role_from_assignments(self, *, commit: bool = True) -> dict:
        assignments = self.active_role_assignments()
        has_leadership = assignments.filter(
            role__in=EmployeeRoleAssignment.Role.leadership_roles()
        ).exists()

        desired_role = self.role
        if self.user and self.user.is_superuser:
            desired_role = self.Role.ADMIN
        elif self.role == self.Role.BUSINESS_PARTNER:
            desired_role = self.Role.BUSINESS_PARTNER
        elif has_leadership:
            desired_role = self.Role.MANAGER
        elif desired_role == self.Role.MANAGER:
            desired_role = self.Role.EMPLOYEE

        updates = {}
        if desired_role != self.role:
            updates['role'] = desired_role
            self.role = desired_role

        if self.is_manager != has_leadership:
            updates['is_manager'] = has_leadership
            self.is_manager = has_leadership

        if updates and commit and self.pk:
            Employee.objects.filter(pk=self.pk).update(**updates)

        return updates

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

    achieved_results = models.TextField(blank=True)
    personal_contribution = models.TextField(blank=True)
    skills_acquired = models.TextField(blank=True)
    improvements_needed = models.TextField(blank=True)
    collaboration_quality = models.IntegerField(choices=[(i, i) for i in range(11)], default=0)
    satisfaction_score = models.IntegerField(choices=[(i, i) for i in range(11)], default=0)

    objective_answers = models.JSONField(default=list, blank=True)
    score_breakdown = models.JSONField(default=dict, blank=True)
    calculated_score = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['employee', 'goal']

class Feedback360(models.Model):
    assessor = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='given_feedbacks')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='received_feedbacks')
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='feedbacks')

    results_achievement = models.IntegerField(choices=[(i, i) for i in range(11)])
    personal_qualities = models.TextField(blank=True)
    collaboration_quality = models.IntegerField(choices=[(i, i) for i in range(11)])
    improvements_suggested = models.TextField(blank=True)

    objective_answers = models.JSONField(default=list, blank=True)
    score_breakdown = models.JSONField(default=dict, blank=True)
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
    score_breakdown = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

class AssessmentQuestionTemplate(models.Model):
    class Context(models.TextChoices):
        SELF = 'self', 'Самооценка'
        FEEDBACK_360 = 'feedback_360', 'Оценка 360'

    ANSWER_TYPES = (
        ('scale', 'Шкала'),
        ('numeric', 'Числовой ответ'),
        ('single_choice', 'Выбор одного варианта'),
        ('boolean', 'Да/Нет'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    context = models.CharField(max_length=20, choices=Context.choices)
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='assessment_questions',
        null=True,
        blank=True,
    )
    category = models.CharField(max_length=120, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    answer_type = models.CharField(max_length=20, choices=ANSWER_TYPES)
    answer_options = models.JSONField(default=list, blank=True)
    correct_answer = models.JSONField(null=True, blank=True)
    max_score = models.PositiveIntegerField(default=10)
    weight = models.PositiveIntegerField(default=1)
    tolerance = models.FloatField(default=0)
    order = models.PositiveIntegerField(default=0)
    complexity = models.CharField(max_length=30, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_assessment_questions',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['context', 'department_id', 'order', 'created_at']
        indexes = [
            models.Index(fields=['context', 'department_id'], name='assessment_q_context_dept_idx'),
            models.Index(fields=['context', 'order'], name='assessment_q_context_order_idx'),
        ]

    def __str__(self) -> str:
        scope = self.department.name if self.department_id else 'Все отделы'
        return f"{self.get_context_display()} • {scope} • {self.title[:60]}"

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


class NineBoxSnapshot(models.Model):
    class Source(models.TextChoices):
        SCHEDULED = 'scheduled', 'Плановое обновление'
        ON_DEMAND = 'on_demand', 'Запрос пользователя'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scope = models.CharField(max_length=64, default='global')
    generated_at = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateTimeField()
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.ON_DEMAND)
    generated_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='nine_box_snapshots',
    )
    payload = models.JSONField(default=dict, blank=True)
    stats = models.JSONField(default=dict, blank=True)
    ai_recommendations = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['scope', 'valid_until'], name='ninebox_scope_valid_idx'),
            models.Index(fields=['generated_at'], name='ninebox_generated_idx'),
        ]

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


class EmployeeRoleAssignmentQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True, revoked_at__isnull=True)


class EmployeeRoleAssignment(models.Model):
    class Role(models.TextChoices):
        ORGANIZATION_LEAD = 'organization_lead', 'Руководитель организации'
        DEPARTMENT_HEAD = 'department_head', 'Руководитель отдела'
        TEAM_LEAD = 'team_lead', 'Руководитель команды'
        POSITION_LEAD = 'position_lead', 'Руководитель должности'
        MENTOR = 'mentor', 'Наставник'
        BUDDY = 'buddy', 'Бадди'

        @classmethod
        def leadership_roles(cls) -> tuple:
            return (
                cls.ORGANIZATION_LEAD,
                cls.DEPARTMENT_HEAD,
                cls.TEAM_LEAD,
                cls.POSITION_LEAD,
            )

        @classmethod
        def support_roles(cls) -> tuple:
            return (cls.MENTOR, cls.BUDDY)

        @classmethod
        def global_roles(cls) -> tuple:
            return (cls.ORGANIZATION_LEAD,)

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='role_assignments',
    )
    role = models.CharField(max_length=50, choices=Role.choices)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='role_assignments',
        null=True,
        blank=True,
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='role_assignments',
        null=True,
        blank=True,
    )
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='role_assignments',
        null=True,
        blank=True,
    )
    position = models.ForeignKey(
        DepartmentPosition,
        on_delete=models.CASCADE,
        related_name='role_assignments',
        null=True,
        blank=True,
    )
    target_employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='support_assignments',
    )
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    objects = EmployeeRoleAssignmentQuerySet.as_manager()

    class Meta:
        ordering = ['employee', 'role', 'assigned_at']
        unique_together = (
            'employee',
            'role',
            'organization',
            'department',
            'team',
            'position',
            'target_employee',
        )
        indexes = [
            models.Index(fields=['role', 'is_active'], name='employee_role_active_idx'),
        ]

    def __str__(self) -> str:
        scope = self.describe_scope()
        return f"{self.employee.user.get_full_name()} → {self.get_role_display()} ({scope})"

    def clean(self):
        from django.core.exceptions import ValidationError

        scope_fields = {
            'organization_id': self.organization_id,
            'department_id': self.department_id,
            'team_id': self.team_id,
            'position_id': self.position_id,
            'target_employee_id': self.target_employee_id,
        }

        leadership_roles = self.Role.leadership_roles()
        support_roles = self.Role.support_roles()

        if self.role in leadership_roles:
            if self.role == self.Role.ORGANIZATION_LEAD and not self.organization_id:
                raise ValidationError('Для роли руководителя организации необходимо указать организацию.')
            if self.role == self.Role.DEPARTMENT_HEAD and not self.department_id:
                raise ValidationError('Для роли руководителя отдела необходимо указать отдел.')
            if self.role == self.Role.TEAM_LEAD and not self.team_id:
                raise ValidationError('Для роли руководителя команды необходимо указать команду.')
            if self.role == self.Role.POSITION_LEAD and not self.position_id:
                raise ValidationError('Для роли руководителя должности необходимо указать должность.')
        elif self.role in support_roles:
            if not self.target_employee_id:
                raise ValidationError('Для ролей наставника и бадди необходимо указать сотрудника.')
        else:
            raise ValidationError('Неизвестная роль.')

        if self.team_id and self.department_id and self.team.department_id != self.department_id:
            raise ValidationError('Команда должна относиться к выбранному отделу.')

        if self.department and self.organization and self.department.organization_id != self.organization_id:
            raise ValidationError('Отдел должен принадлежать выбранной организации.')

        if self.team and self.organization and self.team.department.organization_id != self.organization_id:
            raise ValidationError('Команда должна принадлежать выбранной организации.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        self.employee.sync_role_from_assignments(commit=True)

    def delete(self, *args, **kwargs):
        employee = self.employee
        super().delete(*args, **kwargs)
        employee.sync_role_from_assignments(commit=True)

    def active(self) -> bool:
        return self.is_active and not self.revoked_at

    def describe_scope(self) -> str:
        if self.role == self.Role.ORGANIZATION_LEAD and self.organization:
            return self.organization.name
        if self.role == self.Role.DEPARTMENT_HEAD and self.department:
            return self.department.name
        if self.role == self.Role.TEAM_LEAD and self.team:
            return self.team.name
        if self.role == self.Role.POSITION_LEAD and self.position:
            return self.position.title
        if self.target_employee:
            return self.target_employee.user.get_full_name()
        return '—'

    def visible_employee_ids(self) -> set[int]:
        if not self.active():
            return set()
        if self.role == self.Role.ORGANIZATION_LEAD and self.organization_id:
            return set(
                Employee.objects.filter(
                    department__organization_id=self.organization_id
                ).values_list('id', flat=True)
            )
        if self.role == self.Role.DEPARTMENT_HEAD and self.department_id:
            return set(
                Employee.objects.filter(department_id=self.department_id).values_list('id', flat=True)
            )
        if self.role == self.Role.TEAM_LEAD and self.team_id:
            return set(
                Employee.objects.filter(team_id=self.team_id).values_list('id', flat=True)
            )
        if self.role == self.Role.POSITION_LEAD and self.position_id:
            return set(
                Employee.objects.filter(position_id=self.position_id).values_list('id', flat=True)
            )
        if self.role in self.Role.support_roles() and self.target_employee_id:
            return {self.target_employee_id}
        return set()

    def covers_employee(self, employee: Employee) -> bool:
        if not self.active():
            return False
        if self.role == self.Role.ORGANIZATION_LEAD and self.organization_id:
            org = employee.organization()
            return org and org.id == self.organization_id
        if self.role == self.Role.DEPARTMENT_HEAD and self.department_id:
            return employee.department_id == self.department_id
        if self.role == self.Role.TEAM_LEAD and self.team_id:
            return employee.team_id == self.team_id
        if self.role == self.Role.POSITION_LEAD and self.position_id:
            return employee.position_id == self.position_id
        if self.role in self.Role.support_roles() and self.target_employee_id:
            return employee.id == self.target_employee_id
        return False