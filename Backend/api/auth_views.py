from datetime import datetime

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.settings import api_settings
try:
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
except ModuleNotFoundError:  # blacklist app can be disabled in settings
    BlacklistedToken = None
    OutstandingToken = None

from .models import Department, DepartmentPosition, Employee
from .serializers import (
    AdminEmployeeCreateSerializer,
    EmployeeDetailSerializer,
    EmployeeSerializer,
    UserSerializer,
)
from performance.services import ensure_initial_self_review, sync_employer_from_employee

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Регистрация нового пользователя"""
    try:
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        
        if not username or not password:
            return Response(
                {'error': 'Username and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if User.objects.filter(username=username).exists():
            return Response(
                {'error': 'Username already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = User.objects.create_user(
            username=username,
            password=password,
            email=email,
            first_name=first_name,
            last_name=last_name
        )
        
        # Создаем профиль сотрудника
        department_id = request.data.get('department')
        department = None
        if department_id:
            try:
                department = Department.objects.get(pk=department_id)
            except Department.DoesNotExist:
                return Response(
                    {'error': 'Указанного отдела не существует'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        hire_date_raw = request.data.get('hire_date')
        if hire_date_raw:
            try:
                hire_date = datetime.fromisoformat(hire_date_raw).date()
            except ValueError:
                return Response(
                    {'error': 'Неверный формат даты приема. Используйте YYYY-MM-DD.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            hire_date = timezone.now().date()

        def to_bool(value, default=False):
            if value is None:
                return default
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.strip().lower() in ['1', 'true', 'yes', 'on']
            return bool(value)

        position_id = request.data.get('position')
        position = None
        if position_id:
            try:
                position = DepartmentPosition.objects.get(pk=position_id)
            except DepartmentPosition.DoesNotExist:
                return Response(
                    {'error': 'Указанной должности не существует.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        role_value = request.data.get('role', Employee.Role.EMPLOYEE)
        if role_value not in Employee.Role.values:
            role_value = Employee.Role.EMPLOYEE

        employee = Employee.objects.create(
            user=user,
            department=department,
            position=position,
            position_title=position.title if position else request.data.get('position_title', 'Сотрудник'),
            role=role_value,
            is_manager=to_bool(request.data.get('is_manager'), False) or role_value == Employee.Role.MANAGER,
            hire_date=hire_date,
        )

        employer = sync_employer_from_employee(employee)
        pending_review = None
        if employer:
            log = ensure_initial_self_review(employer)
            if log:
                pending_review = {
                    'token': str(log.token),
                    'expires_at': log.expires_at.isoformat(),
                    'context': log.context,
                    'employer_id': employer.id,
                }
        
        # Генерируем токены
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data,
            'employee_meta': {
                'pending_self_review': pending_review,
                'employer_id': employer.id if employer else None,
            },
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """Вход пользователя"""
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response(
            {'error': 'Username and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = authenticate(username=username, password=password)
    
    if user is None:
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    refresh = RefreshToken.for_user(user)
    
    try:
        employee = Employee.objects.get(user=user)
        employee_data = EmployeeSerializer(employee).data
        employer = sync_employer_from_employee(employee)
        pending_review = None
        if employer:
            log = ensure_initial_self_review(employer)
            if log and log.status != log.STATUS_COMPLETED:
                pending_review = {
                    'token': str(log.token),
                    'expires_at': log.expires_at.isoformat(),
                    'context': log.context,
                    'employer_id': employer.id,
                }
            employee_data['employer_id'] = employer.id
        if pending_review:
            employee_data['pending_self_review'] = pending_review
    except Employee.DoesNotExist:
        employee_data = None
    
    return Response({
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'user': UserSerializer(user).data,
        'employee': employee_data
    })

from django.db import IntegrityError


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Выход пользователя"""
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                jti = token.payload.get(api_settings.JTI_CLAIM)
                if BlacklistedToken and OutstandingToken and jti:
                    outstanding = OutstandingToken.objects.filter(jti=jti).first()
                    if outstanding:
                        BlacklistedToken.objects.get_or_create(token=outstanding)
                    else:
                        token.blacklist()
                else:
                    try:
                        token.blacklist()
                    except IntegrityError:
                        pass
            except (AttributeError, TokenError):
                pass
        return Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """Получение текущего пользователя"""
    try:
        employee = Employee.objects.get(user=request.user)
        employee_data = EmployeeSerializer(employee).data
        employer = sync_employer_from_employee(employee)
        pending_review = None
        if employer:
            log = ensure_initial_self_review(employer)
            if log and log.status != log.STATUS_COMPLETED:
                pending_review = {
                    'token': str(log.token),
                    'expires_at': log.expires_at.isoformat(),
                    'context': log.context,
                    'employer_id': employer.id,
                }
            employee_data['employer_id'] = employer.id
        if pending_review:
            employee_data['pending_self_review'] = pending_review
    except Employee.DoesNotExist:
        employee_data = None
    
    return Response({
        'user': UserSerializer(request.user).data,
        'employee': employee_data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_create_employee(request):
    if not request.user.is_superuser:
        return Response(
            {'error': 'Доступ запрещен. Требуются права администратора.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = AdminEmployeeCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    result = serializer.save()
    employee_data = EmployeeDetailSerializer(result['employee']).data
    user_data = UserSerializer(result['user']).data

    employer = sync_employer_from_employee(result['employee'])
    if employer:
        ensure_initial_self_review(employer)
        employee_data['employer_id'] = employer.id

    return Response(
        {
            'user': user_data,
            'employee': employee_data,
            'temporary_password': result['password'],
        },
        status=status.HTTP_201_CREATED,
    )
