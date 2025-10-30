from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Avg, Count
from django_filters.rest_framework import DjangoFilterBackend
from .models import *
from .serializers import *

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['department', 'is_manager']
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 'position']
    ordering_fields = ['hire_date', 'position']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return EmployeeDetailSerializer
        return EmployeeSerializer
    
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
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['goal_type', 'employee']
    search_fields = ['title', 'description']
    ordering_fields = ['start_date', 'end_date', 'created_at']
    
    def get_queryset(self):
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            if employee.is_manager:
                # Менеджер видит цели своего отдела
                return Goal.objects.filter(employee__department=employee.department)
            return Goal.objects.filter(employee=employee)
        except Employee.DoesNotExist:
            return Goal.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        serializer.save(employee=employee)

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['goal', 'is_completed']
    search_fields = ['title', 'description']
    
    def get_queryset(self):
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            if employee.is_manager:
                return Task.objects.filter(goal__employee__department=employee.department)
            return Task.objects.filter(goal__employee=employee)
        except Employee.DoesNotExist:
            return Task.objects.none()

class SelfAssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = SelfAssessmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'task']
    ordering_fields = ['created_at', 'calculated_score']
    
    def get_queryset(self):
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            if employee.is_manager:
                return SelfAssessment.objects.filter(employee__department=employee.department)
            return SelfAssessment.objects.filter(employee=employee)
        except Employee.DoesNotExist:
            return SelfAssessment.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        
        # Расчет баллов по логике из Excel
        data = serializer.validated_data
        collaboration_score = min(data['collaboration_quality'] // 4, 3)  # 0-10 -> 0-3
        satisfaction_score = min(data['satisfaction_score'] // 5, 2)  # 0-10 -> 0-2
        
        total_score = collaboration_score + satisfaction_score
        serializer.save(employee=employee, calculated_score=total_score)

class Feedback360ViewSet(viewsets.ModelViewSet):
    serializer_class = Feedback360Serializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['assessor', 'employee', 'task']
    ordering_fields = ['created_at', 'calculated_score']
    
    def get_queryset(self):
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            # Пользователь видит оценки, которые он дал
            return Feedback360.objects.filter(assessor=employee)
        except Employee.DoesNotExist:
            return Feedback360.objects.none()
    
    @action(detail=False, methods=['get'])
    def for_me(self, request):
        """Получить все оценки 360 для текущего пользователя"""
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            feedbacks = Feedback360.objects.filter(employee=employee)
            serializer = self.get_serializer(feedbacks, many=True)
            return Response(serializer.data)
        except Employee.DoesNotExist:
            return Response([], status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Получить список сотрудников, которым нужно дать оценку"""
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            # Получаем коллег из того же отдела
            colleagues = Employee.objects.filter(
                department=employee.department
            ).exclude(id=employee.id)
            serializer = EmployeeSerializer(colleagues, many=True)
            return Response(serializer.data)
        except Employee.DoesNotExist:
            return Response([], status=status.HTTP_200_OK)
    
    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        
        # Расчет баллов по логике из Excel
        data = serializer.validated_data
        results_score = min(data['results_achievement'] // 4, 3)  # 0-10 -> 0-3
        collaboration_score = min(data['collaboration_quality'] // 4, 3)  # 0-10 -> 0-3
        
        total_score = results_score + collaboration_score
        serializer.save(assessor=employee, calculated_score=total_score)

class ManagerReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ManagerReviewSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['manager', 'employee', 'task']
    ordering_fields = ['created_at', 'calculated_score']
    
    def get_queryset(self):
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            if employee.is_manager:
                # Менеджер видит свои оценки
                return ManagerReview.objects.filter(manager=employee)
            else:
                # Сотрудник видит оценки, данные ему
                return ManagerReview.objects.filter(employee=employee)
        except Employee.DoesNotExist:
            return ManagerReview.objects.none()
    
    @action(detail=False, methods=['get'])
    def my_team(self, request):
        """Получить список сотрудников для оценки (для менеджера)"""
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            if not employee.is_manager:
                return Response(
                    {'error': 'Only managers can access this endpoint'},
                    status=status.HTTP_403_FORBIDDEN
                )
            team = Employee.objects.filter(
                department=employee.department,
                is_manager=False
            )
            serializer = EmployeeSerializer(team, many=True)
            return Response(serializer.data)
        except Employee.DoesNotExist:
            return Response([], status=status.HTTP_200_OK)
    
    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        
        if not employee.is_manager:
            raise PermissionError('Only managers can create reviews')
        
        # Расчет баллов по сложной логике из Excel
        data = serializer.validated_data
        results_score = min(data['results_achievement'] // 4, 3)
        collaboration_score = min(data['collaboration_quality'] // 4, 3)
        overall_rating_score = min(data['overall_rating'] // 4, 3)
        
        total_score = results_score + collaboration_score + overall_rating_score
        serializer.save(manager=employee, calculated_score=total_score)

class PotentialAssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = PotentialAssessmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['manager', 'employee', 'development_desire', 'is_successor']
    ordering_fields = ['created_at', 'performance_score', 'potential_score']
    
    def get_queryset(self):
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            if employee.is_manager:
                return PotentialAssessment.objects.filter(manager=employee)
            else:
                return PotentialAssessment.objects.filter(employee=employee)
        except Employee.DoesNotExist:
            return PotentialAssessment.objects.none()
    
    @action(detail=False, methods=['get'])
    def nine_box_matrix(self, request):
        """Получить данные для 9-Box матрицы"""
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            if not employee.is_manager:
                return Response(
                    {'error': 'Only managers can access this endpoint'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            assessments = PotentialAssessment.objects.filter(
                manager=employee
            ).select_related('employee', 'employee__user')
            
            matrix_data = []
            for assessment in assessments:
                matrix_data.append({
                    'employee_id': assessment.employee.id,
                    'employee_name': assessment.employee.user.get_full_name(),
                    'position': assessment.employee.position,
                    'performance_score': assessment.performance_score,
                    'potential_score': assessment.potential_score,
                    'nine_box_x': assessment.nine_box_x,
                    'nine_box_y': assessment.nine_box_y,
                })
            
            return Response(matrix_data)
        except Employee.DoesNotExist:
            return Response([], status=status.HTTP_200_OK)
    
    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.get(user=user)
        
        if not employee.is_manager:
            raise PermissionError('Only managers can create potential assessments')
        
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
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'review_period', 'salary_recommendation']
    ordering_fields = ['created_at', 'total_score']
    
    def get_queryset(self):
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            if employee.is_manager:
                return FinalReview.objects.filter(employee__department=employee.department)
            return FinalReview.objects.filter(employee=employee)
        except Employee.DoesNotExist:
            return FinalReview.objects.none()
    
    @action(detail=True, methods=['post'])
    def calculate_final_score(self, request, pk=None):
        """Рассчитать итоговый балл для отзыва"""
        final_review = self.get_object()
        employee_target = final_review.employee
        
        # Расчет итоговых баллов
        self_assessments = SelfAssessment.objects.filter(employee=employee_target)
        feedbacks = Feedback360.objects.filter(employee=employee_target)
        manager_reviews = ManagerReview.objects.filter(employee=employee_target)
        potential_assessments = PotentialAssessment.objects.filter(employee=employee_target)
        
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
        
        final_review.self_assessment_score = round(self_score, 2)
        final_review.feedback_360_score = round(feedback_score, 2)
        final_review.manager_review_score = round(manager_score, 2)
        final_review.potential_score = round(potential_score, 2)
        final_review.total_score = round(total_score, 2)
        final_review.salary_recommendation = salary_recommendation
        final_review.save()
        
        serializer = self.get_serializer(final_review)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Получить статистику по всем отзывам"""
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            if not employee.is_manager:
                return Response(
                    {'error': 'Only managers can access statistics'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            reviews = FinalReview.objects.filter(employee__department=employee.department)
            
            stats = {
                'total_reviews': reviews.count(),
                'average_score': reviews.aggregate(Avg('total_score'))['total_score__avg'] or 0,
                'salary_recommendations': {
                    'include': reviews.filter(salary_recommendation='include').count(),
                    'conditional': reviews.filter(salary_recommendation='conditional').count(),
                    'exclude': reviews.filter(salary_recommendation='exclude').count(),
                }
            }
            
            return Response(stats)
        except Employee.DoesNotExist:
            return Response({}, status=status.HTTP_200_OK)