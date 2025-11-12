from datetime import datetime

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.settings import api_settings
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse
try:
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
except ModuleNotFoundError:
    BlacklistedToken = None
    OutstandingToken = None

from .models import Department, DepartmentPosition, Employee, EmployeeRoleAssignment
from .serializers import (
    AdminEmployeeCreateSerializer,
    EmployeeDetailSerializer,
    EmployeeSerializer,
    UserSerializer,
)
from performance.services import ensure_initial_self_review, sync_employer_from_employee


REFRESH_COOKIE_NAME = settings.SIMPLE_JWT.get('REFRESH_TOKEN_COOKIE_NAME', 'rasti_refresh_token')
REFRESH_COOKIE_PATH = settings.SIMPLE_JWT.get('REFRESH_TOKEN_COOKIE_PATH', '/')
REFRESH_COOKIE_DOMAIN = settings.SIMPLE_JWT.get('REFRESH_TOKEN_COOKIE_DOMAIN')
REFRESH_COOKIE_SECURE = settings.SIMPLE_JWT.get('REFRESH_TOKEN_COOKIE_SECURE', True)
REFRESH_COOKIE_SAMESITE = settings.SIMPLE_JWT.get('REFRESH_TOKEN_COOKIE_SAMESITE', 'Strict')


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=REFRESH_COOKIE_SECURE,
        samesite=REFRESH_COOKIE_SAMESITE,
        path=REFRESH_COOKIE_PATH,
        domain=REFRESH_COOKIE_DOMAIN,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        domain=REFRESH_COOKIE_DOMAIN,
        samesite=REFRESH_COOKIE_SAMESITE,
    )


class CookieTokenRefreshSerializer(TokenRefreshSerializer):
    refresh = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context.get('request')
        refresh_token = attrs.get('refresh') or (request.COOKIES.get(REFRESH_COOKIE_NAME) if request else None)
        if not refresh_token:
            raise serializers.ValidationError({'refresh': 'Refresh token is missing.'})
        attrs['refresh'] = refresh_token
        return super().validate(attrs)


class CookieTokenRefreshView(TokenRefreshView):
    serializer_class = CookieTokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = dict(serializer.validated_data)
        rotated_refresh = validated.pop('refresh', None)
        response = Response(validated, status=status.HTTP_200_OK)
        refresh_value = rotated_refresh or request.COOKIES.get(REFRESH_COOKIE_NAME)
        if refresh_value:
            _set_refresh_cookie(response, refresh_value)
        return response

@extend_schema(
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'username': {'type': 'string'},
                'password': {'type': 'string'},
                'email': {'type': 'string', 'format': 'email'},
                'first_name': {'type': 'string'},
                'last_name': {'type': 'string'},
                'department': {'type': 'integer'},
                'hire_date': {'type': 'string', 'format': 'date'},
                'position': {'type': 'integer'},
                'role': {'type': 'string', 'enum': ['employee', 'manager', 'admin', 'business_partner']},
            },
            'required': ['username', 'password'],
        }
    },
    responses={201: UserSerializer},
    tags=['Authentication']
)
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
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

        if employee.department and employee.is_manager:
            EmployeeRoleAssignment.objects.get_or_create(
                employee=employee,
                role=EmployeeRoleAssignment.Role.DEPARTMENT_HEAD,
                organization=employee.department.organization,
                department=employee.department,
            )
            employee.sync_role_from_assignments(commit=True)

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
        
        refresh = RefreshToken.for_user(user)
        
        response = Response({
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data,
            'employee_meta': {
                'pending_self_review': pending_review,
                'employer_id': employer.id if employer else None,
            },
        }, status=status.HTTP_201_CREATED)
        _set_refresh_cookie(response, str(refresh))
        return response
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@extend_schema(
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'username': {'type': 'string'},
                'password': {'type': 'string'},
            },
            'required': ['username', 'password'],
        }
    },
    responses={
        200: {
            'type': 'object',
            'properties': {
                'refresh': {'type': 'string'},
                'access': {'type': 'string'},
                'user': {'type': 'object'},
                'employee': {'type': 'object'},
            }
        }
    },
    tags=['Authentication']
)
@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
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
    
    employee_data = None
    try:
        employee = Employee.objects.get(user=user)
        employee_data = EmployeeSerializer(employee).data
        
        try:
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
        except Exception:
            pass
    except Employee.DoesNotExist:
        pass
    
    response = Response({
        'access': str(refresh.access_token),
        'user': UserSerializer(user).data,
        'employee': employee_data
    })
    _set_refresh_cookie(response, str(refresh))
    return response

from django.db import IntegrityError


@extend_schema(
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'refresh': {'type': 'string'},
            },
        }
    },
    responses={200: {'type': 'object', 'properties': {'message': {'type': 'string'}}}},
    tags=['Authentication']
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    try:
        refresh_token = request.data.get('refresh') or request.COOKIES.get(REFRESH_COOKIE_NAME)
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
        response = Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
        _clear_refresh_cookie(response)
        return response
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(
    responses={200: {'type': 'object', 'properties': {'user': {'type': 'object'}, 'employee': {'type': 'object'}}}},
    tags=['Authentication']
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    employee_data = None
    try:
        employee = Employee.objects.get(user=request.user)
        employee_data = EmployeeSerializer(employee).data
        
        try:
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
        except Exception:
            pass
    except Employee.DoesNotExist:
        pass
    
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
