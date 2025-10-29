from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Avg, Count
from .models import *
from .serializers import *

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    
    @action(detail=False, methods=['get'])
    def managers(self, request):
        managers = Employee.objects.filter(is_manager=True)
        serializer = self.get_serializer(managers, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def team(self, request, pk=None):
        employee = self.get_object()
        # Логика получения команды сотрудника
        team = Employee.objects.filter(department=employee.department).exclude(id=employee.id)
        serializer = self.get_serializer(team, many=True)
        return Response(serializer.data)

class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer
    
    def get_queryset(self):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        return Goal.objects.filter(employee=employee)
    
    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        serializer.save(employee=employee)

class SelfAssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = SelfAssessmentSerializer
    
    def get_queryset(self):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        return SelfAssessment.objects.filter(employee=employee)
    
    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        
        # Расчет баллов по логике из Excel
        data = serializer.validated_data
        collaboration_score = min(data['collaboration_quality'] // 4, 3)  # 0-10 -> 0-2
        satisfaction_score = min(data['satisfaction_score'] // 5, 2)  # 0-10 -> 0-2
        
        total_score = collaboration_score + satisfaction_score
        serializer.save(employee=employee, calculated_score=total_score)

class Feedback360ViewSet(viewsets.ModelViewSet):
    serializer_class = Feedback360Serializer
    
    def get_queryset(self):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        return Feedback360.objects.filter(assessor=employee)
    
    @action(detail=False, methods=['get'])
    def for_me(self, request):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        feedbacks = Feedback360.objects.filter(employee=employee)
        serializer = self.get_serializer(feedbacks, many=True)
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        
        # Расчет баллов по логике из Excel
        data = serializer.validated_data
        results_score = min(data['results_achievement'] // 4, 3)  # 0-10 -> 0-2
        collaboration_score = min(data['collaboration_quality'] // 4, 3)  # 0-10 -> 0-2
        
        total_score = results_score + collaboration_score
        serializer.save(assessor=employee, calculated_score=total_score)

class ManagerReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ManagerReviewSerializer
    
    def get_queryset(self):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        return ManagerReview.objects.filter(manager=employee)
    
    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        
        # Расчет баллов по сложной логике из Excel
        data = serializer.validated_data
        results_score = min(data['results_achievement'] // 4, 3)
        collaboration_score = min(data['collaboration_quality'] // 4, 3)
        overall_rating_score = min(data['overall_rating'] // 4, 3)
        
        total_score = results_score + collaboration_score + overall_rating_score
        serializer.save(manager=employee, calculated_score=total_score)

class PotentialAssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = PotentialAssessmentSerializer
    
    def get_queryset(self):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        return PotentialAssessment.objects.filter(manager=employee)
    
    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        
        data = serializer.validated_data
        
        # Расчет баллов результативности (упрощенная логика)
        performance_score = 0
        if data.get('professional_qualities'):
            performance_score += len(data['professional_qualities'])
        
        # Расчет баллов потенциала
        potential_score = 0
        if data.get('personal_qualities'):
            potential_score += len(data['personal_qualities'])
        
        if data.get('development_desire') in ['proactive', 'needs_help']:
            potential_score += 2
        
        if data.get('is_successor'):
            potential_score += 3
            if data.get('successor_readiness') == '1-2':
                potential_score += 2
            elif data.get('successor_readiness') == '3':
                potential_score += 1
        
        # Расчет риска ухода
        risk_score = data.get('retention_risk', 0)
        if risk_score <= 2:
            potential_score += 3
        elif risk_score <= 5:
            potential_score += 2
        elif risk_score <= 7:
            potential_score += 1
        
        # Позиционирование в 9-Box
        nine_box_x = min(performance_score // 2, 2)  # 0-2 для оси X
        nine_box_y = min(potential_score // 5, 2)   # 0-2 для оси Y
        
        serializer.save(
            manager=employee,
            performance_score=performance_score,
            potential_score=potential_score,
            nine_box_x=nine_box_x,
            nine_box_y=nine_box_y
        )

class FinalReviewViewSet(viewsets.ModelViewSet):
    serializer_class = FinalReviewSerializer
    
    def get_queryset(self):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        if employee.is_manager:
            return FinalReview.objects.filter(employee__department=employee.department)
        return FinalReview.objects.filter(employee=employee)
    
    @action(detail=True, methods=['post'])
    def calculate_final_score(self, request, pk=None):
        final_review = self.get_object()
        employee = final_review.employee
        
        # Расчет итоговых баллов
        self_assessments = SelfAssessment.objects.filter(employee=employee)
        feedbacks = Feedback360.objects.filter(employee=employee)
        manager_reviews = ManagerReview.objects.filter(employee=employee)
        potential_assessments = PotentialAssessment.objects.filter(employee=employee)
        
        self_score = self_assessments.aggregate(Avg('calculated_score'))['calculated_score__avg'] or 0
        feedback_score = feedbacks.aggregate(Avg('calculated_score'))['calculated_score__avg'] or 0
        manager_score = manager_reviews.aggregate(Avg('calculated_score'))['calculated_score__avg'] or 0
        potential_score = potential_assessments.aggregate(Avg('potential_score'))['potential_score__avg'] or 0
        
        total_score = self_score + feedback_score + manager_score + potential_score
        
        # Определение рекомендации по salary increase
        if total_score <= 12:
            salary_recommendation = 'exclude'
        elif total_score <= 15:
            salary_recommendation = 'conditional'
        else:
            salary_recommendation = 'include'
        
        final_review.self_assessment_score = self_score
        final_review.feedback_360_score = feedback_score
        final_review.manager_review_score = manager_score
        final_review.potential_score = potential_score
        final_review.total_score = total_score
        final_review.salary_recommendation = salary_recommendation
        final_review.save()
        
        serializer = self.get_serializer(final_review)
        return Response(serializer.data)