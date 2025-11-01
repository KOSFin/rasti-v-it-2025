from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.exceptions import ValidationError
from django.db.models import Q, Avg, Count
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from .models import *
from .serializers import *

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

    def get_permissions(self):
        if self.request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            return [IsAdminUser()]
        return super().get_permissions()

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related('user', 'department', 'position').all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['department', 'role']
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 'position_title']
    ordering_fields = ['hire_date', 'position_title']
    manager_update_actions = {'update', 'partial_update'}

    def _current_employee(self):
        if not hasattr(self, '_cached_employee'):
            try:
                self._cached_employee = Employee.objects.select_related('department').get(user=self.request.user)
            except Employee.DoesNotExist:
                self._cached_employee = None
        return self._cached_employee
    
    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return self.queryset
        employee = self._current_employee()
        if not employee:
            return self.queryset.none()

        if employee.role == Employee.Role.BUSINESS_PARTNER:
            return self.queryset
        if employee.role == Employee.Role.MANAGER:
            return self.queryset.filter(
                Q(department=employee.department) | Q(pk=employee.pk)
            )
        return self.queryset.filter(pk=employee.pk)

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

    @action(detail=False, methods=['get'])
    def colleagues(self, request):
        employee = self._current_employee()
        if not employee:
            return Response([], status=status.HTTP_200_OK)

        colleagues = Employee.objects.select_related('user', 'department', 'position').filter(
            department=employee.department
        ).exclude(pk=employee.pk).order_by('user__last_name', 'user__first_name')

        serializer = self.get_serializer(colleagues, many=True)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        user = instance.user
        instance.delete()
        if user and not Employee.objects.filter(user=user).exists():
            user.delete()

    def _ensure_can_modify(self, request, employee=None):
        if request.user.is_superuser:
            return True
        current_employee = self._current_employee()
        if not current_employee:
            raise ValidationError({'detail': 'Профиль сотрудника не найден.'})
        if current_employee.role == Employee.Role.BUSINESS_PARTNER:
            raise ValidationError({'detail': 'У вас нет прав для изменения данных сотрудников.'})
        if current_employee.role != Employee.Role.MANAGER:
            if request.method in ['PUT', 'PATCH'] and employee and employee.pk == current_employee.pk:
                return True
            raise ValidationError({'detail': 'Недостаточно прав.'})
        # Менеджеру разрешено редактировать сотрудников только своего отдела
        if employee and employee.department_id != current_employee.department_id and employee.pk != current_employee.pk:
            raise ValidationError({'detail': 'Можно редактировать только сотрудников своего отдела.'})
        return True

    def create(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            return Response(
                {'detail': 'Создавать сотрудников могут только администраторы.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        employee = self.get_object()
        self._ensure_can_modify(request, employee)
        return self._update_employee_instance(request, employee, partial=False)

    def partial_update(self, request, *args, **kwargs):
        employee = self.get_object()
        self._ensure_can_modify(request, employee)
        return self._update_employee_instance(request, employee, partial=True)

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            return Response(
                {'detail': 'Удалять сотрудников могут только администраторы.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    def _update_employee_instance(self, request, employee, partial):
        data = request.data.copy()
        user = employee.user

        user_fields = {}
        for user_field in ['first_name', 'last_name', 'email', 'username']:
            if user_field in data:
                user_fields[user_field] = data.pop(user_field)

        is_superuser = data.pop('is_superuser', None)
        is_staff = data.pop('is_staff', None)
        new_role = data.get('role')

        if new_role and not request.user.is_superuser:
            current_employee = self._current_employee()
            allowed_roles = {Employee.Role.EMPLOYEE, Employee.Role.MANAGER}
            if current_employee and current_employee.role != Employee.Role.MANAGER:
                allowed_roles = {Employee.Role.EMPLOYEE}
            if new_role not in allowed_roles:
                return Response({'detail': 'Вы не можете назначить выбранную роль.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(employee, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if user_fields:
            for field, value in user_fields.items():
                setattr(user, field, value)
            user.save(update_fields=list(user_fields.keys()))

        if is_staff is not None and request.user.is_superuser:
            user.is_staff = bool(is_staff)
            user.save(update_fields=['is_staff'])

        if is_superuser is not None and request.user.is_superuser:
            user.is_superuser = bool(is_superuser)
            if user.is_superuser:
                user.is_staff = True
            user.save(update_fields=['is_superuser', 'is_staff'])

        return Response(self.get_serializer(employee).data)

    @action(detail=True, methods=['post'])
    def generate_password(self, request, pk=None):
        if not request.user.is_superuser:
            return Response({'error': 'Недостаточно прав'}, status=status.HTTP_403_FORBIDDEN)

        employee = self.get_object()
        from django.utils.crypto import get_random_string

        password = get_random_string(
            length=12,
            allowed_chars='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%'
        )

        user = employee.user
        user.set_password(password)
        user.save(update_fields=['password'])

        return Response({
            'username': user.username,
            'temporary_password': password,
            'employee_id': employee.id,
        })

class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['goal_type', 'employee', 'is_completed', 'creator_type', 'participants']
    search_fields = ['title', 'description']
    ordering_fields = ['start_date', 'end_date', 'created_at']

    def _parse_participant_ids(self, allow_none=False):
        raw = self.request.data.get('participant_ids', self.request.data.get('participants'))
        if raw is None:
            return None if allow_none else []

        if isinstance(raw, (list, tuple)):
            items = raw
        elif isinstance(raw, str):
            if not raw.strip():
                return [] if not allow_none else []
            # Попытка распарсить JSON-подобные строки
            if raw.strip().startswith('[') and raw.strip().endswith(']'):
                raw = raw.strip()[1:-1]
            items = [item.strip() for item in raw.split(',') if item.strip()]
        else:
            items = [raw]

        participant_ids = []
        for item in items:
            try:
                participant_ids.append(int(item))
            except (TypeError, ValueError):
                continue
        return participant_ids

    def _ordered_participants(self, participant_ids):
        participants = Employee.objects.filter(id__in=participant_ids).select_related('department', 'user')
        participants_map = {participant.id: participant for participant in participants}
        ordered = []
        for pid in participant_ids:
            participant = participants_map.get(pid)
            if participant and participant not in ordered:
                ordered.append(participant)
        return ordered
    
    def get_queryset(self):
        user = self.request.user
        queryset = Goal.objects.all().prefetch_related(
            'tasks',
            'goal_participants__employee__user',
            'goal_participants__employee__department'
        ).select_related('employee__user', 'employee__department', 'created_by__user')

        if user.is_superuser:
            return queryset

        employee = Employee.objects.filter(user=user).select_related('department').first()
        if not employee:
            return queryset.none()

        if employee.role == Employee.Role.BUSINESS_PARTNER:
            return queryset

        if employee.role == Employee.Role.MANAGER:
            return queryset.filter(
                Q(goal_participants__employee__department=employee.department) |
                Q(created_by=employee) |
                Q(evaluation_notifications__recipient=employee)
            ).distinct()

        # Сотрудник видит цели, в которых участвует, или которые он создал
        return queryset.filter(
            Q(goal_participants__employee=employee) |
            Q(created_by=employee) |
            Q(evaluation_notifications__recipient=employee)
        ).distinct()
    
    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_value = self.kwargs.get(self.lookup_field)

        try:
            obj = queryset.get(**{self.lookup_field: lookup_value})
        except Goal.DoesNotExist:
            employee = Employee.objects.filter(user=self.request.user).first()
            notification_exists = (
                employee
                and GoalEvaluationNotification.objects.filter(
                    goal_id=lookup_value,
                    recipient=employee
                ).exists()
            )
            if not notification_exists:
                raise

            fallback_queryset = Goal.objects.prefetch_related(
                'tasks',
                'goal_participants__employee__user',
                'goal_participants__employee__department'
            ).select_related('employee__user', 'employee__department', 'created_by__user')
            obj = get_object_or_404(fallback_queryset, **{self.lookup_field: lookup_value})

        self.check_object_permissions(self.request, obj)
        return obj

    def perform_create(self, serializer):
        user = self.request.user
        current_employee = Employee.objects.filter(user=user).first()
        if not current_employee and not user.is_superuser:
            raise ValidationError({'employee': 'Профиль сотрудника не найден. Обратитесь к администратору.'})

        raw_requires = self.request.data.get('requires_evaluation', False)
        if isinstance(raw_requires, str):
            requires_evaluation = raw_requires.strip().lower() in {'1', 'true', 'yes', 'on'}
        else:
            requires_evaluation = bool(raw_requires)

        participant_ids = self._parse_participant_ids()
        participants_ordered = self._ordered_participants(participant_ids)

        if user.is_superuser:
            creator = current_employee
        else:
            creator = current_employee

        invalid = []
        if creator and creator.role == Employee.Role.MANAGER:
            # Менеджер может добавлять участников только из своего отдела
            invalid = [
                participant for participant in participants_ordered
                if participant.department_id != creator.department_id
            ]
        if invalid:
            raise ValidationError({'participants': 'Можно назначать цель только сотрудникам своего отдела.'})

        if not participants_ordered and creator and creator.role != Employee.Role.BUSINESS_PARTNER:
            participants_ordered = [creator]
            participant_ids = [creator.id]

        if not participants_ordered:
            raise ValidationError({'participants': 'Необходимо указать хотя бы одного участника цели.'})

        primary_employee = participants_ordered[0]

        if creator and primary_employee == creator:
            creator_type = 'self'
            requires_evaluation = False
        else:
            creator_type = 'manager'

        goal = serializer.save(
            employee=primary_employee,
            created_by=creator,
            creator_type=creator_type,
            requires_evaluation=requires_evaluation
        )

        # Синхронизируем участников
        GoalParticipant.objects.filter(goal=goal).delete()
        for participant in participants_ordered:
            GoalParticipant.objects.create(
                goal=goal,
                employee=participant,
                is_owner=participant == primary_employee
            )

        goal.refresh_from_db()

    def perform_update(self, serializer):
        goal = self.get_object()
        user = self.request.user
        current_employee = Employee.objects.filter(user=user).select_related('department').first()

        if not current_employee and not user.is_superuser:
            raise ValidationError({'detail': 'Профиль сотрудника не найден.'})

        participant_ids = self._parse_participant_ids(allow_none=True)

        if participant_ids is not None:
            participants_ordered = self._ordered_participants(participant_ids)

            if current_employee and current_employee.role == Employee.Role.MANAGER and not user.is_superuser:
                invalid = [
                    participant for participant in participants_ordered
                    if participant.department_id != current_employee.department_id
                ]
                if invalid:
                    raise ValidationError({'participants': 'Можно назначать цель только сотрудникам своего отдела.'})

            if not participants_ordered:
                raise ValidationError({'participants': 'Необходимо указать хотя бы одного участника цели.'})
        else:
            participants_ordered = list(goal.participants.all())

        primary_employee = participants_ordered[0] if participants_ordered else None

        serializer.save(employee=primary_employee)

        if participant_ids is not None:
            GoalParticipant.objects.filter(goal=goal).exclude(employee__in=participants_ordered).delete()
            existing_map = {
                gp.employee_id: gp for gp in GoalParticipant.objects.filter(goal=goal)
            }
            for participant in participants_ordered:
                obj = existing_map.get(participant.id)
                if obj:
                    if obj.is_owner != (participant == primary_employee):
                        obj.is_owner = participant == primary_employee
                        obj.save(update_fields=['is_owner'])
                else:
                    GoalParticipant.objects.create(
                        goal=goal,
                        employee=participant,
                        is_owner=participant == primary_employee
                    )

        goal.refresh_from_db()
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Завершить цель и запустить оценку"""
        from django.utils import timezone
        
        goal = self.get_object()
        user = request.user
        
        try:
            employee = Employee.objects.get(user=user)
        except Employee.DoesNotExist:
            return Response({'error': 'Сотрудник не найден'}, status=status.HTTP_404_NOT_FOUND)
        
        # Проверяем, что пользователь имеет право завершить цель
        if not user.is_superuser and not goal.participants.filter(pk=employee.pk).exists():
            return Response({'error': 'Вы не можете завершить эту цель'}, status=status.HTTP_403_FORBIDDEN)
        
        # Проверяем, что все задачи выполнены
        uncompleted_tasks = goal.tasks.filter(is_completed=False).count()
        if uncompleted_tasks > 0:
            return Response(
                {'error': f'Не все задачи выполнены. Осталось: {uncompleted_tasks}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Получаем параметр запуска оценки
        launch_evaluation = request.data.get('launch_evaluation', goal.requires_evaluation)
        
        # Завершаем цель
        goal.is_completed = True
        goal.completed_at = timezone.now()
        goal.evaluation_launched = bool(launch_evaluation)
        goal.save()
        
        # Если нужно запустить оценку
        if launch_evaluation:
            participant_departments = list(
                goal.participants.values_list('department_id', flat=True)
            )

            colleagues = Employee.objects.filter(
                department_id__in=[dept_id for dept_id in participant_departments if dept_id]
            ).exclude(
                id__in=goal.participants.values_list('id', flat=True)
            ).distinct()

            for colleague in colleagues:
                GoalEvaluationNotification.objects.get_or_create(
                    recipient=colleague,
                    goal=goal
                )
        
        serializer = self.get_serializer(goal)
        return Response(serializer.data)

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['goal', 'is_completed']
    search_fields = ['title', 'description']
    ordering_fields = ['order', 'created_at']
    
    def get_queryset(self):
        user = self.request.user
        base_queryset = Task.objects.select_related('goal').prefetch_related('goal__goal_participants')

        if user.is_superuser:
            return base_queryset

        employee = Employee.objects.filter(user=user).select_related('department').first()
        if not employee:
            return base_queryset.none()

        if employee.role == Employee.Role.BUSINESS_PARTNER:
            return base_queryset

        if employee.role == Employee.Role.MANAGER:
            return base_queryset.filter(
                goal__goal_participants__employee__department=employee.department
            ).distinct()

        return base_queryset.filter(
            goal__goal_participants__employee=employee
        ).distinct()
    
    def perform_update(self, serializer):
        from django.utils import timezone
        
        task = self.get_object()
        user = self.request.user
        employee = Employee.objects.filter(user=user).select_related('department').first()

        if not user.is_superuser:
            if not employee:
                raise ValidationError({'detail': 'Профиль сотрудника не найден.'})

            if employee.role == Employee.Role.MANAGER:
                if not task.goal.participants.filter(department=employee.department).exists():
                    raise ValidationError({'detail': 'Можно обновлять задачи только своего отдела.'})
            elif not task.goal.participants.filter(pk=employee.pk).exists():
                raise ValidationError({'detail': 'Вы не участник этой цели.'})

        is_completed = serializer.validated_data.get('is_completed', task.is_completed)
        completed_by = serializer.validated_data.get('completed_by', None)

        if completed_by and not task.goal.participants.filter(pk=completed_by.pk).exists():
            raise ValidationError({'completed_by': 'Сотрудник не участвует в этой цели.'})

        if not completed_by and is_completed:
            completed_by = employee if employee else task.completed_by
        
        # Если задача отмечается как выполненная
        if is_completed and not task.is_completed:
            serializer.save(
                completed_at=timezone.now(),
                completed_by=completed_by
            )
        # Если задача отмечается как невыполненная
        elif not is_completed and task.is_completed:
            serializer.save(completed_at=None, completed_by=None)
        else:
            serializer.save()

class SelfAssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = SelfAssessmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'goal']
    ordering_fields = ['created_at', 'calculated_score']
    
    def get_queryset(self):
        user = self.request.user
        employee = Employee.objects.filter(user=user).select_related('department').first()
        if not employee and not user.is_superuser:
            return SelfAssessment.objects.none()

        if user.is_superuser:
            return SelfAssessment.objects.select_related('goal', 'employee')

        if employee.role == Employee.Role.BUSINESS_PARTNER:
            return SelfAssessment.objects.select_related('goal', 'employee')

        if employee.role == Employee.Role.MANAGER:
            return SelfAssessment.objects.filter(
                Q(employee__department=employee.department) |
                Q(goal__goal_participants__employee=employee)
            ).select_related('goal', 'employee').distinct()

        return SelfAssessment.objects.filter(employee=employee).select_related('goal', 'employee')
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Получить список целей, для которых нужно заполнить самооценку"""
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            # Находим завершенные цели с запущенной оценкой, для которых еще нет самооценки
            completed_goals = Goal.objects.filter(
                goal_participants__employee=employee,
                is_completed=True,
                evaluation_launched=True
            ).exclude(
                self_assessments__employee=employee
            )
            serializer = GoalSerializer(completed_goals, many=True)
            return Response(serializer.data)
        except Employee.DoesNotExist:
            return Response([], status=status.HTTP_200_OK)
    
    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.filter(user=user).first()
        if not employee:
            raise ValidationError({'detail': 'Профиль сотрудника не найден.'})

        goal = serializer.validated_data.get('goal')
        if goal and not goal.participants.filter(pk=employee.pk).exists():
            raise ValidationError({'detail': 'Вы не участвуете в этой цели.'})
        
        # Расчет баллов по логике из Excel
        data = serializer.validated_data
        collaboration_score = min(data['collaboration_quality'] // 4, 3)  # 0-10 -> 0-3
        satisfaction_score = min(data['satisfaction_score'] // 5, 2)  # 0-10 -> 0-2
        
        total_score = collaboration_score + satisfaction_score
        serializer.save(employee=employee, calculated_score=total_score)

    def perform_update(self, serializer):
        data = serializer.validated_data
        instance = serializer.instance

        collaboration_raw = data.get('collaboration_quality', instance.collaboration_quality)
        satisfaction_raw = data.get('satisfaction_score', instance.satisfaction_score)

        collaboration_score = min(collaboration_raw // 4, 3)
        satisfaction_score = min(satisfaction_raw // 5, 2)

        total_score = collaboration_score + satisfaction_score
        serializer.save(calculated_score=total_score)

class Feedback360ViewSet(viewsets.ModelViewSet):
    serializer_class = Feedback360Serializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['assessor', 'employee', 'goal']
    ordering_fields = ['created_at', 'calculated_score']
    
    def get_queryset(self):
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            # Пользователь видит оценки, которые он дал
            return Feedback360.objects.filter(assessor=employee).select_related('goal', 'employee')
        except Employee.DoesNotExist:
            return Feedback360.objects.none()
    
    @action(detail=False, methods=['get'])
    def for_me(self, request):
        """Получить все оценки 360 для текущего пользователя"""
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            feedbacks = Feedback360.objects.filter(employee=employee).select_related('goal', 'assessor')
            serializer = self.get_serializer(feedbacks, many=True)
            return Response(serializer.data)
        except Employee.DoesNotExist:
            return Response([], status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Получить список уведомлений о необходимости оценить цели коллег"""
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            # Получаем непрочитанные и невыполненные уведомления
            notifications = GoalEvaluationNotification.objects.filter(
                recipient=employee,
                is_completed=False
            ).select_related('goal').prefetch_related('goal__goal_participants__employee__user')
            serializer = GoalEvaluationNotificationSerializer(notifications, many=True)
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
        
        # Отметить уведомление как выполненное
        goal = data['goal']
        try:
            notification = GoalEvaluationNotification.objects.get(
                recipient=employee,
                goal=goal
            )
            notification.is_completed = True
            notification.save()
        except GoalEvaluationNotification.DoesNotExist:
            pass

class ManagerReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ManagerReviewSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['manager', 'employee', 'goal']
    ordering_fields = ['created_at', 'calculated_score']
    
    def get_queryset(self):
        user = self.request.user
        queryset = ManagerReview.objects.select_related('goal', 'employee', 'manager')

        if user.is_superuser:
            return queryset

        employee = Employee.objects.filter(user=user).select_related('department').first()
        if not employee:
            return queryset.none()

        if employee.role == Employee.Role.BUSINESS_PARTNER:
            return queryset

        if employee.role == Employee.Role.MANAGER:
            return queryset.filter(
                Q(manager=employee) | Q(employee__department=employee.department)
            ).distinct()

        return queryset.filter(employee=employee)
    
    @action(detail=False, methods=['get'])
    def my_team(self, request):
        """Получить список сотрудников для оценки (для менеджера)"""
        user = self.request.user
        employee = Employee.objects.filter(user=user).select_related('department').first()
        if not employee or employee.role != Employee.Role.MANAGER:
            return Response(
                {'error': 'Only managers can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )

        team = Employee.objects.filter(
            department=employee.department
        ).exclude(id=employee.id)
        serializer = EmployeeSerializer(team, many=True)
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.filter(user=user).select_related('department').first()

        if not employee and not user.is_superuser:
            raise ValidationError({'detail': 'Профиль сотрудника не найден.'})

        if not user.is_superuser and employee.role != Employee.Role.MANAGER:
            raise PermissionError('Only managers can create reviews')
        
        # Расчет баллов по сложной логике из Excel
        data = serializer.validated_data
        results_score = min(data['results_achievement'] // 4, 3)
        collaboration_score = min(data['collaboration_quality'] // 4, 3)
        overall_rating_score = min(data['overall_rating'] // 4, 3)
        
        total_score = results_score + collaboration_score + overall_rating_score
        review_employee = data['employee']
        goal = data['goal']

        if employee and employee.role == Employee.Role.MANAGER:
            if review_employee.department_id != employee.department_id:
                raise ValidationError({'employee': 'Можно оценивать только сотрудников своего отдела.'})
        if not goal.participants.filter(pk=review_employee.pk).exists():
            raise ValidationError({'goal': 'Сотрудник не участвует в указанной цели.'})

        serializer.save(manager=employee if employee else None, calculated_score=total_score)

class PotentialAssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = PotentialAssessmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['manager', 'employee', 'development_desire', 'is_successor']
    ordering_fields = ['created_at', 'performance_score', 'potential_score']
    
    def get_queryset(self):
        user = self.request.user
        queryset = PotentialAssessment.objects.select_related('manager', 'employee')

        if user.is_superuser:
            return queryset

        employee = Employee.objects.filter(user=user).select_related('department').first()
        if not employee:
            return queryset.none()

        if employee.role == Employee.Role.BUSINESS_PARTNER:
            return queryset

        if employee.role == Employee.Role.MANAGER:
            return queryset.filter(manager=employee)

        return queryset.filter(employee=employee)
    
    @action(detail=False, methods=['get'])
    def nine_box_matrix(self, request):
        """Получить данные для 9-Box матрицы"""
        user = self.request.user
        employee = Employee.objects.filter(user=user).select_related('department').first()

        if user.is_superuser:
            assessments = PotentialAssessment.objects.all().select_related('employee', 'employee__user')
        elif not employee:
            return Response([], status=status.HTTP_200_OK)
        elif employee.role == Employee.Role.BUSINESS_PARTNER:
            assessments = PotentialAssessment.objects.all().select_related('employee', 'employee__user')
        elif employee.role == Employee.Role.MANAGER:
            assessments = PotentialAssessment.objects.filter(
                manager=employee
            ).select_related('employee', 'employee__user')
        else:
            return Response(
                {'error': 'Only managers or бизнес-партнеры могут просматривать матрицу'},
                status=status.HTTP_403_FORBIDDEN
            )

        matrix_data = []
        for assessment in assessments:
            matrix_data.append({
                'employee_id': assessment.employee.id,
                'employee_name': assessment.employee.user.get_full_name(),
                'position': assessment.employee.position_title or '',
                'performance_score': assessment.performance_score,
                'potential_score': assessment.potential_score,
                'nine_box_x': assessment.nine_box_x,
                'nine_box_y': assessment.nine_box_y,
            })

        return Response(matrix_data)
    
    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.filter(user=user).select_related('department').first()

        if not employee and not user.is_superuser:
            raise ValidationError({'detail': 'Профиль сотрудника не найден.'})

        if not user.is_superuser and employee.role != Employee.Role.MANAGER:
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
            manager=employee if employee else None,
            performance_score=performance_score,
            potential_score=potential_score,
            nine_box_x=nine_box_x,
            nine_box_y=nine_box_y
        )

class GoalEvaluationNotificationViewSet(viewsets.ModelViewSet):
    serializer_class = GoalEvaluationNotificationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['is_read', 'is_completed']
    ordering_fields = ['created_at']
    
    def get_queryset(self):
        user = self.request.user
        employee = Employee.objects.filter(user=user).first()
        if not employee:
            return GoalEvaluationNotification.objects.none()

        return GoalEvaluationNotification.objects.filter(recipient=employee).select_related('goal').prefetch_related('goal__goal_participants__employee__user')
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Получить количество непрочитанных уведомлений"""
        user = self.request.user
        try:
            employee = Employee.objects.get(user=user)
            count = GoalEvaluationNotification.objects.filter(
                recipient=employee,
                is_completed=False
            ).count()
            return Response({'count': count})
        except Employee.DoesNotExist:
            return Response({'count': 0})
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Отметить уведомление как прочитанное"""
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        serializer = self.get_serializer(notification)
        return Response(serializer.data)

class FinalReviewViewSet(viewsets.ModelViewSet):
    serializer_class = FinalReviewSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'review_period', 'salary_recommendation']
    ordering_fields = ['created_at', 'total_score']
    
    def get_queryset(self):
        user = self.request.user
        queryset = FinalReview.objects.select_related('employee', 'employee__department')

        if user.is_superuser:
            return queryset

        employee = Employee.objects.filter(user=user).select_related('department').first()
        if not employee:
            return queryset.none()

        if employee.role == Employee.Role.BUSINESS_PARTNER:
            return queryset

        if employee.role == Employee.Role.MANAGER:
            return queryset.filter(employee__department=employee.department)

        return queryset.filter(employee=employee)
    
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
        employee = Employee.objects.filter(user=user).select_related('department').first()

        if user.is_superuser:
            reviews = FinalReview.objects.all()
        elif not employee:
            return Response({}, status=status.HTTP_200_OK)
        elif employee.role == Employee.Role.BUSINESS_PARTNER:
            reviews = FinalReview.objects.all()
        elif employee.role == Employee.Role.MANAGER:
            reviews = FinalReview.objects.filter(employee__department=employee.department)
        else:
            return Response(
                {'error': 'Только менеджеры или бизнес-партнеры могут просматривать статистику'},
                status=status.HTTP_403_FORBIDDEN
            )

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