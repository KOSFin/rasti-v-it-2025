from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Employee
from .serializers import EmployeeSerializer, UserSerializer

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
        employee_data = {
            'department': request.data.get('department'),
            'position': request.data.get('position', 'Сотрудник'),
            'is_manager': request.data.get('is_manager', False),
            'hire_date': request.data.get('hire_date'),
        }
        
        Employee.objects.create(user=user, **employee_data)
        
        # Генерируем токены
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data
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
    except Employee.DoesNotExist:
        employee_data = None
    
    return Response({
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'user': UserSerializer(user).data,
        'employee': employee_data
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Выход пользователя"""
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
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
    except Employee.DoesNotExist:
        employee_data = None
    
    return Response({
        'user': UserSerializer(request.user).data,
        'employee': employee_data
    })
