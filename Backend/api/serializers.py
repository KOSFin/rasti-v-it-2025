from rest_framework import serializers
from .models import *

class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = Employee
        fields = '__all__'

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