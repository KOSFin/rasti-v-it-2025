from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Department,
    DepartmentPosition,
    Employee,
    EmployeeRoleAssignment,
    Goal,
    GoalEvaluationNotification,
    GoalParticipant,
    ManagerReview,
    Organization,
    PotentialAssessment,
    SelfAssessment,
    Task,
    Team,
    Feedback360,
    FinalReview,
)


class OrganizationSerializer(serializers.ModelSerializer):
    departments_count = serializers.IntegerField(source='departments.count', read_only=True)

    class Meta:
        model = Organization
        fields = ['id', 'name', 'description', 'is_active', 'departments_count']

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser']

class DepartmentPositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DepartmentPosition
        fields = ['id', 'title', 'importance']


class DepartmentSerializer(serializers.ModelSerializer):
    employees_count = serializers.IntegerField(source='employee_set.count', read_only=True)
    positions = DepartmentPositionSerializer(many=True, required=False)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    parent_name = serializers.CharField(source='parent.name', read_only=True)

    class Meta:
        model = Department
        fields = [
            'id', 'name', 'description', 'organization', 'organization_name',
            'parent', 'parent_name', 'employees_count', 'positions'
        ]

    def create(self, validated_data):
        positions_data = validated_data.pop('positions', [])
        department = super().create(validated_data)
        self._sync_positions(department, positions_data)
        return department

    def update(self, instance, validated_data):
        positions_data = validated_data.pop('positions', None)
        department = super().update(instance, validated_data)
        if positions_data is not None:
            self._sync_positions(department, positions_data)
        return department

    def _sync_positions(self, department, positions_data):
        existing = {pos.id: pos for pos in department.positions.all()}
        seen_ids = set()

        for index, payload in enumerate(positions_data):
            pos_id = payload.get('id')
            importance = payload.get('importance', index)
            title = (payload.get('title') or '').strip()
            if not title:
                continue

            if pos_id and pos_id in existing:
                position = existing[pos_id]
                position.title = title
                position.importance = importance
                position.save(update_fields=['title', 'importance'])
                seen_ids.add(pos_id)
            else:
                position = DepartmentPosition.objects.create(
                    department=department,
                    title=title,
                    importance=importance,
                )
                seen_ids.add(position.id)

        to_delete = [pos for pos_id, pos in existing.items() if pos_id not in seen_ids]
        for pos in to_delete:
            if not pos.employees.exists():
                pos.delete()


class TeamSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    organization_id = serializers.IntegerField(source='department.organization_id', read_only=True)
    organization_name = serializers.CharField(source='department.organization.name', read_only=True)

    class Meta:
        model = Team
        fields = [
            'id',
            'name',
            'description',
            'department',
            'department_name',
            'organization_id',
            'organization_name',
            'parent',
            'parent_name',
        ]


class EmployeeRoleAssignmentSerializer(serializers.ModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all())
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    scope = serializers.SerializerMethodField()
    target_employee_name = serializers.CharField(source='target_employee.user.get_full_name', read_only=True)

    class Meta:
        model = EmployeeRoleAssignment
        fields = [
            'id',
            'employee',
            'employee_name',
            'role',
            'role_display',
            'scope',
            'organization',
            'department',
            'team',
            'position',
            'target_employee',
            'target_employee_name',
            'is_active', 'assigned_at', 'revoked_at'
        ]
        read_only_fields = ['assigned_at', 'revoked_at']

    def get_scope(self, obj):
        return obj.describe_scope()


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    organization_name = serializers.CharField(source='department.organization.name', read_only=True)
    organization_id = serializers.IntegerField(source='department.organization_id', read_only=True)
    user_is_staff = serializers.BooleanField(source='user.is_staff', read_only=True)
    user_is_superuser = serializers.BooleanField(source='user.is_superuser', read_only=True)
    position_name = serializers.CharField(source='position.title', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    can_manage_department = serializers.SerializerMethodField()
    team_name = serializers.CharField(source='team.name', read_only=True)
    active_roles = serializers.SerializerMethodField()
    team = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), allow_null=True, required=False)

    class Meta:
        model = Employee
        fields = [
            'id', 'user', 'department', 'department_name', 'organization_id', 'organization_name', 'position', 'position_title',
            'position_name', 'team', 'team_name', 'role', 'role_display', 'is_manager', 'hire_date',
            'full_name', 'email', 'username', 'user_is_staff', 'user_is_superuser',
            'can_manage_department', 'active_roles'
        ]
        extra_kwargs = {
            'user': {'read_only': True},
            'position_title': {'required': False, 'allow_blank': True},
            'position': {'required': False, 'allow_null': True},
            'department': {'required': False, 'allow_null': True},
            'team': {'required': False, 'allow_null': True},
        }

    def get_can_manage_department(self, obj):
        if not obj.department_id:
            return False
        if obj.has_global_visibility():
            return True
        return obj.active_role_assignments().filter(
            role=EmployeeRoleAssignment.Role.DEPARTMENT_HEAD,
            department_id=obj.department_id,
        ).exists()

    def get_active_roles(self, obj):
        assignments = obj.active_role_assignments()
        return EmployeeRoleAssignmentSerializer(assignments, many=True, context=self.context).data

    def update(self, instance, validated_data):
        position = validated_data.get('position')
        if position:
            validated_data.setdefault('position_title', position.title)
        elif 'position' in validated_data and position is None:
            validated_data.setdefault('position_title', '')

        if 'team' in validated_data:
            team = validated_data['team']
            target_department = validated_data.get('department', instance.department)
            if team and target_department and team.department_id != target_department.id:
                raise serializers.ValidationError({'team': 'Команда должна относиться к выбранному отделу.'})

        return super().update(instance, validated_data)


class EmployeeDetailSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    department = DepartmentSerializer(read_only=True)
    position = DepartmentPositionSerializer(read_only=True)
    team = TeamSerializer(read_only=True)
    role_assignments = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = '__all__'

    def get_role_assignments(self, obj):
        return EmployeeRoleAssignmentSerializer(
            obj.active_role_assignments(), many=True, context=self.context
        ).data


class AdminEmployeeCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    position_title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    position = serializers.PrimaryKeyRelatedField(
        queryset=DepartmentPosition.objects.select_related('department'),
        required=False,
        allow_null=True,
    )
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), allow_null=True, required=False
    )
    team = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.select_related('department'),
        required=False,
        allow_null=True,
    )
    is_manager = serializers.BooleanField(default=False)
    is_staff = serializers.BooleanField(default=False)
    username = serializers.CharField(max_length=150, required=False, allow_blank=True)
    hire_date = serializers.DateField(required=False)
    role = serializers.ChoiceField(
        choices=Employee.Role.choices,
        default=Employee.Role.EMPLOYEE,
    )
    is_superuser = serializers.BooleanField(default=False)

    def validate_email(self, value):
        email = value.lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError('Почта уже используется другим пользователем.')
        return email

    def validate_username(self, value):
        username = value.strip()
        if username and User.objects.filter(username=username).exists():
            raise serializers.ValidationError('Имя пользователя уже занято.')
        return username

    def create(self, validated_data):
        from django.utils import timezone
        from django.utils.crypto import get_random_string

        department = validated_data.pop('department', None)
        is_staff = validated_data.pop('is_staff', False)
        username = (validated_data.pop('username', '') or '').strip().lower()
        hire_date = validated_data.pop('hire_date', None)
        position = validated_data.pop('position', None)
        position_title = (validated_data.pop('position_title', '') or '').strip()
        role = validated_data.pop('role', Employee.Role.EMPLOYEE)
        is_superuser = validated_data.pop('is_superuser', False)
        team = validated_data.pop('team', None)

        email = validated_data['email']
        first_name = validated_data['first_name'].strip()
        last_name = validated_data['last_name'].strip()
        is_manager = validated_data.get('is_manager', False)

        if not username:
            base_username = (email.split('@')[0] or 'user').lower()
            candidate = base_username
            counter = 1
            while User.objects.filter(username=candidate).exists():
                candidate = f"{base_username}{counter}"
                counter += 1
            username = candidate

        password = get_random_string(
            length=12,
            allowed_chars='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%'
        )

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        if is_staff != user.is_staff:
            user.is_staff = is_staff
            user.save(update_fields=['is_staff'])

        if is_superuser and not user.is_superuser:
            user.is_superuser = True
            user.is_staff = True
            user.save(update_fields=['is_superuser', 'is_staff'])

        if team and department and team.department_id != department.id:
            raise serializers.ValidationError({'team': 'Команда должна относиться к выбранному отделу.'})

        employee = Employee.objects.create(
            user=user,
            department=department,
            position=position,
            position_title=position.title if position else (position_title or 'Сотрудник'),
            team=team,
            role=role,
            is_manager=is_manager or role == Employee.Role.MANAGER,
            hire_date=hire_date or timezone.now().date(),
        )

        if employee.department and (is_manager or role == Employee.Role.MANAGER):
            EmployeeRoleAssignment.objects.get_or_create(
                employee=employee,
                role=EmployeeRoleAssignment.Role.DEPARTMENT_HEAD,
                organization=employee.department.organization,
                department=employee.department,
            )
            employee.sync_role_from_assignments(commit=True)

        return {
            'user': user,
            'employee': employee,
            'password': password,
        }

class TaskSerializer(serializers.ModelSerializer):
    completed_by_name = serializers.CharField(source='completed_by.user.get_full_name', read_only=True)

    class Meta:
        model = Task
        fields = '__all__'


class GoalParticipantSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    position_name = serializers.CharField(source='employee.position_title', read_only=True)

    class Meta:
        model = GoalParticipant
        fields = ['id', 'employee', 'employee_name', 'position_name', 'is_owner', 'joined_at']

class GoalSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.user.get_full_name', read_only=True, allow_null=True)
    tasks = TaskSerializer(many=True, read_only=True)
    tasks_completed = serializers.SerializerMethodField()
    tasks_total = serializers.SerializerMethodField()
    evaluations_total = serializers.SerializerMethodField()
    evaluations_completed = serializers.SerializerMethodField()
    evaluations_pending = serializers.SerializerMethodField()
    awaits_self_assessment = serializers.SerializerMethodField()
    awaits_peer_reviews = serializers.SerializerMethodField()
    self_assessment_submitted = serializers.SerializerMethodField()
    participants_info = GoalParticipantSerializer(source='goal_participants', many=True, read_only=True)
    participant_ids = serializers.PrimaryKeyRelatedField(
        source='participants', queryset=Employee.objects.all(), many=True, required=False
    )

    class Meta:
        model = Goal
        fields = '__all__'
        extra_kwargs = {
            'employee': {'required': False, 'allow_null': True},
            'created_by': {'required': False, 'allow_null': True},
        }
    
    def get_tasks_completed(self, obj):
        return obj.tasks.filter(is_completed=True).count()
    
    def get_tasks_total(self, obj):
        return obj.tasks.count()

    def get_evaluations_total(self, obj):
        return obj.evaluation_notifications.count()

    def get_evaluations_completed(self, obj):
        return obj.evaluation_notifications.filter(is_completed=True).count()

    def get_evaluations_pending(self, obj):
        return obj.evaluation_notifications.filter(is_completed=False).count()

    def get_self_assessment_submitted(self, obj):
        return obj.self_assessments.filter(employee__in=obj.participants.all()).exists()

    def get_awaits_self_assessment(self, obj):
        if not obj.evaluation_launched:
            return False
        return obj.participants.exclude(
            id__in=obj.self_assessments.values_list('employee_id', flat=True)
        ).exists()

    def get_awaits_peer_reviews(self, obj):
        if not obj.evaluation_launched:
            return False
        return obj.evaluation_notifications.filter(is_completed=False).exists()

    def get_employee_name(self, obj):
        if obj.employee_id:
            return obj.employee.user.get_full_name()
        participants = obj.goal_participants.select_related('employee__user')
        return ', '.join([p.employee.user.get_full_name() for p in participants])

    def get_department_name(self, obj):
        if obj.employee and obj.employee.department:
            return obj.employee.department.name
        departments = {
            participant.employee.department.name
            for participant in obj.goal_participants.select_related('employee__department')
            if participant.employee.department
        }
        return ', '.join(sorted(departments)) if departments else ''



class SelfAssessmentSerializer(serializers.ModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    goal_title = serializers.CharField(source='goal.title', read_only=True)
    goal_tasks = TaskSerializer(source='goal.tasks', many=True, read_only=True)

    class Meta:
        model = SelfAssessment
        fields = '__all__'
        extra_kwargs = {
            'employee': {'required': False},
        }

class Feedback360Serializer(serializers.ModelSerializer):
    assessor = serializers.PrimaryKeyRelatedField(read_only=True)
    assessor_name = serializers.CharField(source='assessor.user.get_full_name', read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    goal_title = serializers.CharField(source='goal.title', read_only=True)
    goal_tasks = TaskSerializer(source='goal.tasks', many=True, read_only=True)
    
    class Meta:
        model = Feedback360
        fields = '__all__'
        extra_kwargs = {
            'assessor': {'required': False},
        }

class ManagerReviewSerializer(serializers.ModelSerializer):
    manager = serializers.PrimaryKeyRelatedField(read_only=True)
    manager_name = serializers.CharField(source='manager.user.get_full_name', read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    goal_title = serializers.CharField(source='goal.title', read_only=True)
    goal_tasks = TaskSerializer(source='goal.tasks', many=True, read_only=True)
    
    class Meta:
        model = ManagerReview
        fields = '__all__'
        extra_kwargs = {
            'manager': {'required': False},
        }

class GoalEvaluationNotificationSerializer(serializers.ModelSerializer):
    recipient_name = serializers.CharField(source='recipient.user.get_full_name', read_only=True)
    goal_title = serializers.CharField(source='goal.title', read_only=True)
    goal_employee_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    message = serializers.SerializerMethodField()
    link = serializers.SerializerMethodField()
    context = serializers.SerializerMethodField()
    participants = GoalParticipantSerializer(source='goal.goal_participants', many=True, read_only=True)
    
    class Meta:
        model = GoalEvaluationNotification
        fields = '__all__'

    def get_title(self, obj):
        return f'Оценка цели "{obj.goal.title}"'

    def get_message(self, obj):
        owner = obj.goal.employee.user.get_full_name() if obj.goal.employee_id else 'команды'
        base = f'Нужно оценить выполнение цели "{obj.goal.title}" для {owner}.'
        if obj.goal.employee and obj.goal.employee.department and obj.goal.employee.department.name:
            return f"{base} Отдел: {obj.goal.employee.department.name}."
        return base

    def get_link(self, obj):
        return f"/feedback-360?goal={obj.goal_id}"

    def get_context(self, obj):
        return 'goal_evaluation'

    def get_goal_employee_name(self, obj):
        if obj.goal.employee_id:
            return obj.goal.employee.user.get_full_name()
        return ', '.join(
            participant.employee.user.get_full_name()
            for participant in obj.goal.goal_participants.select_related('employee__user')
        )

    def get_department_name(self, obj):
        if obj.goal.employee and obj.goal.employee.department:
            return obj.goal.employee.department.name
        departments = {
            participant.employee.department.name
            for participant in obj.goal.goal_participants.select_related('employee__department')
            if participant.employee.department
        }
        return ', '.join(sorted(departments)) if departments else ''

class PotentialAssessmentSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source='manager.user.get_full_name', read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    
    class Meta:
        model = PotentialAssessment
        fields = '__all__'
        extra_kwargs = {
            'manager': {'required': False},
        }

class FinalReviewSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    
    class Meta:
        model = FinalReview
        fields = '__all__'