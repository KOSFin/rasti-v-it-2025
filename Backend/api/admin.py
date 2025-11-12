from django.contrib import admin
from .models import (
    Department,
    Employee,
    EmployeeRoleAssignment,
    FinalReview,
    Feedback360,
    Goal,
    GoalEvaluationNotification,
    Organization,
    PotentialAssessment,
    SelfAssessment,
    Task,
    Team,
    ManagerReview,
)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name']

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'organization', 'parent']
    list_filter = ['organization']
    search_fields = ['name', 'organization__name']


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ['name', 'department', 'parent']
    list_filter = ['department']
    search_fields = ['name', 'department__name']

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ['user', 'department', 'team', 'position', 'is_manager', 'hire_date']
    list_filter = ['is_manager', 'department', 'team']
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 'position']


@admin.register(EmployeeRoleAssignment)
class EmployeeRoleAssignmentAdmin(admin.ModelAdmin):
    list_display = ['employee', 'role', 'organization', 'department', 'team', 'position', 'target_employee', 'is_active', 'assigned_at']
    list_filter = ['role', 'is_active', 'organization', 'department', 'team']
    search_fields = ['employee__user__first_name', 'employee__user__last_name', 'employee__user__username']

@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ['title', 'employee', 'creator_type', 'goal_type', 'requires_evaluation', 'is_completed', 'start_date', 'end_date']
    list_filter = ['goal_type', 'creator_type', 'requires_evaluation', 'is_completed', 'start_date', 'end_date']
    search_fields = ['title', 'employee__user__username']

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'goal', 'is_completed']
    list_filter = ['is_completed']
    search_fields = ['title']

@admin.register(SelfAssessment)
class SelfAssessmentAdmin(admin.ModelAdmin):
    list_display = ['employee', 'goal', 'calculated_score', 'created_at']
    list_filter = ['created_at']
    search_fields = ['employee__user__username']

@admin.register(Feedback360)
class Feedback360Admin(admin.ModelAdmin):
    list_display = ['assessor', 'employee', 'goal', 'calculated_score', 'created_at']
    list_filter = ['created_at']
    search_fields = ['assessor__user__username', 'employee__user__username']

@admin.register(ManagerReview)
class ManagerReviewAdmin(admin.ModelAdmin):
    list_display = ['manager', 'employee', 'goal', 'calculated_score', 'created_at']
    list_filter = ['created_at']
    search_fields = ['manager__user__username', 'employee__user__username']

@admin.register(GoalEvaluationNotification)
class GoalEvaluationNotificationAdmin(admin.ModelAdmin):
    list_display = ['recipient', 'goal', 'is_read', 'is_completed', 'created_at']
    list_filter = ['is_read', 'is_completed', 'created_at']
    search_fields = ['recipient__user__username', 'goal__title']

@admin.register(PotentialAssessment)
class PotentialAssessmentAdmin(admin.ModelAdmin):
    list_display = ['manager', 'employee', 'performance_score', 'potential_score', 'nine_box_x', 'nine_box_y', 'created_at']
    list_filter = ['created_at', 'development_desire']
    search_fields = ['manager__user__username', 'employee__user__username']

@admin.register(FinalReview)
class FinalReviewAdmin(admin.ModelAdmin):
    list_display = ['employee', 'review_period', 'total_score', 'salary_recommendation', 'created_at']
    list_filter = ['salary_recommendation', 'created_at']
    search_fields = ['employee__user__username', 'review_period']
