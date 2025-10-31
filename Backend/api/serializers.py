from rest_framework import serializers
from django.contrib.auth.models import User
from .models import *

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser']

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'

class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    user_is_staff = serializers.BooleanField(source='user.is_staff', read_only=True)
    user_is_superuser = serializers.BooleanField(source='user.is_superuser', read_only=True)
    
    class Meta:
        model = Employee
        fields = '__all__'

class EmployeeDetailSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    department = DepartmentSerializer(read_only=True)
    
    class Meta:
        model = Employee
        fields = '__all__'


class AdminEmployeeCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    position = serializers.CharField(max_length=200)
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), allow_null=True, required=False
    )
    is_manager = serializers.BooleanField(default=False)
    is_staff = serializers.BooleanField(default=False)
    username = serializers.CharField(max_length=150, required=False, allow_blank=True)
    hire_date = serializers.DateField(required=False)

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

    email = validated_data['email']
        first_name = validated_data['first_name'].strip()
        last_name = validated_data['last_name'].strip()
        position = validated_data['position'].strip() or 'Сотрудник'
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

        employee = Employee.objects.create(
            user=user,
            department=department,
            position=position,
            is_manager=is_manager,
            hire_date=hire_date or timezone.now().date(),
        )

        return {
            'user': user,
            'employee': employee,
            'password': password,
        }

class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = '__all__'

class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = '__all__'

class SelfAssessmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    task_title = serializers.CharField(source='task.title', read_only=True)
    
    class Meta:
        model = SelfAssessment
        fields = '__all__'

class Feedback360Serializer(serializers.ModelSerializer):
    assessor_name = serializers.CharField(source='assessor.user.get_full_name', read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    task_title = serializers.CharField(source='task.title', read_only=True)
    
    class Meta:
        model = Feedback360
        fields = '__all__'

class ManagerReviewSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source='manager.user.get_full_name', read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    task_title = serializers.CharField(source='task.title', read_only=True)
    
    class Meta:
        model = ManagerReview
        fields = '__all__'

class PotentialAssessmentSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source='manager.user.get_full_name', read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    
    class Meta:
        model = PotentialAssessment
        fields = '__all__'

class FinalReviewSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    
    class Meta:
        model = FinalReview
        fields = '__all__'