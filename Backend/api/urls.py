from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from . import auth_views

router = DefaultRouter()
router.register(r'departments', views.DepartmentViewSet, basename='department')
router.register(r'employees', views.EmployeeViewSet, basename='employee')
router.register(r'goals', views.GoalViewSet, basename='goal')
router.register(r'tasks', views.TaskViewSet, basename='task')
router.register(r'self-assessments', views.SelfAssessmentViewSet, basename='self-assessment')
router.register(r'feedback-360', views.Feedback360ViewSet, basename='feedback-360')
router.register(r'manager-reviews', views.ManagerReviewViewSet, basename='manager-review')
router.register(r'potential-assessments', views.PotentialAssessmentViewSet, basename='potential-assessment')
router.register(r'final-reviews', views.FinalReviewViewSet, basename='final-review')
router.register(r'goal-notifications', views.GoalEvaluationNotificationViewSet, basename='goal-notification')

urlpatterns = [
    path('api/', include(router.urls)),
    
    path('api/auth/register/', auth_views.register, name='register'),
    path('api/auth/login/', auth_views.login, name='login'),
    path('api/auth/logout/', auth_views.logout, name='logout'),
    path('api/auth/me/', auth_views.current_user, name='current_user'),
    path('api/auth/admin/create-employee/', auth_views.admin_create_employee, name='admin_create_employee'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]