from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'employees', views.EmployeeViewSet)
router.register(r'goals', views.GoalViewSet)
router.register(r'self-assessments', views.SelfAssessmentViewSet)
router.register(r'feedback-360', views.Feedback360ViewSet)
router.register(r'manager-reviews', views.ManagerReviewViewSet)
router.register(r'potential-assessments', views.PotentialAssessmentViewSet)
router.register(r'final-reviews', views.FinalReviewViewSet)

urlpatterns = [
    path('api/', include(router.urls)),
]