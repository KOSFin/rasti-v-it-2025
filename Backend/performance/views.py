
from datetime import date, timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, extend_schema_view

from api.models import Employee
from .models import Employer, ReviewGoal, ReviewPeriod, ReviewTask, SiteNotification
from .serializers import (
    AdaptationIndexQuerySerializer,
    AnalyticsQuerySerializer,
    NotificationSerializer,
    ReviewCycleTriggerSerializer,
    ReviewSubmitSerializer,
    SkillReviewFeedbackSubmitSerializer,
    SkillReviewQueueItemSerializer,
    TaskGoalCreateSerializer,
    TaskReviewSubmitSerializer,
    TaskReviewTriggerSerializer,
)
from .services import (
    ServiceError,
    adaptation_index,
    create_goal_with_tasks,
    fetch_skill_form,
    fetch_task_form,
    generate_skill_review_cycles,
    manager_skill_review_queue,
    manager_team_employer_ids,
    review_analytics,
    skill_review_overview,
    submit_skill_answers,
    submit_skill_feedback,
    submit_task_answers,
    trigger_task_reviews,
    sync_employer_from_employee,
)


def _service_error_response(error: ServiceError) -> Response:
    return Response(
        {
            "status": "error",
            "code": error.code,
            "message": error.message,
        },
        status=error.status,
    )


class ReviewCycleInitiateView(APIView):

    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        serializer = ReviewCycleTriggerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        current_date = serializer.get_current_date()
        result = generate_skill_review_cycles(current_date)
        return Response({"status": "success", **result})


class ReviewFormView(APIView):

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get("token")
        if not token:
            return Response(
                {"status": "error", "message": "Token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            payload = fetch_skill_form(token)
        except ServiceError as error:
            return _service_error_response(error)
        return Response(payload)


class ReviewSubmitView(APIView):

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ReviewSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        save_mode = serializer.validated_data.get("save_mode") == "partial"
        try:
            result = submit_skill_answers(
                str(serializer.validated_data["token"]),
                serializer.validated_data["answers"],
                partial=save_mode,
            )
        except ServiceError as error:
            return _service_error_response(error)
        return Response(result)


class ReviewAnalyticsView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = AnalyticsQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        employer = get_object_or_404(Employer, pk=serializer.validated_data["employer_id"])
        period = None
        period_id = serializer.validated_data.get("period_id")
        if period_id is not None:
            period = get_object_or_404(ReviewPeriod, pk=period_id)
        result = review_analytics(
            employer=employer,
            period=period,
            skill_type=serializer.validated_data["skills_type"],
        )
        return Response(result)


class SkillReviewOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        employer = Employer.objects.filter(user=request.user).first()
        employee = Employee.objects.filter(user=request.user).first()

        if not employer and employee:
            employer = sync_employer_from_employee(employee)

        employer_id = request.query_params.get("employer_id")
        target_employer = employer

        if employer_id:
            target_employer = get_object_or_404(Employer, pk=employer_id)
            if not request.user.is_superuser:
                if not employer:
                    return Response(
                        {"detail": "Недостаточно прав для просмотра данных другого сотрудника."},
                        status=status.HTTP_403_FORBIDDEN,
                    )

                if target_employer.id != employer.id:
                    allowed_roles = {
                        Employee.Role.MANAGER,
                        Employee.Role.BUSINESS_PARTNER,
                        Employee.Role.ADMIN,
                    }
                    if not employee or employee.role not in allowed_roles:
                        return Response(
                            {"detail": "Недостаточно прав для просмотра данных другого сотрудника."},
                            status=status.HTTP_403_FORBIDDEN,
                        )

                    allowed_ids = set(manager_team_employer_ids(employer))
                    allowed_ids.add(employer.id)

                    if target_employer.id not in allowed_ids:
                        return Response(
                            {"detail": "Недостаточно прав для просмотра данных этого сотрудника."},
                            status=status.HTTP_403_FORBIDDEN,
                        )

        if not target_employer:
            return Response(
                {"detail": "Профиль сотрудника не найден. Обратитесь к администратору."},
                status=status.HTTP_404_NOT_FOUND,
            )

        payload = skill_review_overview(target_employer)
        return Response(payload)


class SkillReviewManagerQueueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        employer = Employer.objects.filter(user=request.user).first()
        employee = Employee.objects.filter(user=request.user).first()

        if not employer and employee:
            employer = sync_employer_from_employee(employee)

        if not employer and request.user.is_superuser:
            placeholder_email = request.user.email or f"admin+{request.user.id}@local"
            placeholder_name = request.user.get_full_name() or request.user.username or "Администратор"
            employer, _ = Employer.objects.get_or_create(
                user=request.user,
                defaults={
                    "fio": placeholder_name,
                    "email": placeholder_email,
                    "date_of_employment": timezone.now().date(),
                    "position": "Администратор",
                },
            )

        if not employer:
            return Response(
                {"detail": "Профиль не найден. Обратитесь к администратору."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not request.user.is_superuser:
            allowed_roles = {
                Employee.Role.MANAGER,
                Employee.Role.ADMIN,
                Employee.Role.BUSINESS_PARTNER,
            }
            if not employee or employee.role not in allowed_roles:
                return Response(
                    {"detail": "Недостаточно прав для просмотра очереди тестов."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        payload = manager_skill_review_queue(employer)
        serializer = SkillReviewQueueItemSerializer(payload["items"], many=True)
        return Response({"items": serializer.data, "stats": payload["stats"]})


class SkillReviewFeedbackView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = SkillReviewFeedbackSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.validated_data["message"].strip()

        employer = Employer.objects.filter(user=request.user).first()
        employee = Employee.objects.filter(user=request.user).first()

        if not employer and employee:
            employer = sync_employer_from_employee(employee)

        if not employer and request.user.is_superuser:
            placeholder_email = request.user.email or f"admin+{request.user.id}@local"
            placeholder_name = request.user.get_full_name() or request.user.username or "Администратор"
            employer, _ = Employer.objects.get_or_create(
                user=request.user,
                defaults={
                    "fio": placeholder_name,
                    "email": placeholder_email,
                    "date_of_employment": timezone.now().date(),
                    "position": "Администратор",
                },
            )

        if not employer:
            return Response(
                {"detail": "Профиль не найден. Обратитесь к администратору."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not request.user.is_superuser:
            allowed_roles = {
                Employee.Role.MANAGER,
                Employee.Role.ADMIN,
                Employee.Role.BUSINESS_PARTNER,
            }
            if not employee or employee.role not in allowed_roles:
                return Response(
                    {"detail": "Недостаточно прав для отправки фидбека."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        try:
            result = submit_skill_feedback(
                employer,
                log_id=serializer.validated_data["log_id"],
                message=message,
            )
        except ServiceError as error:
            return _service_error_response(error)

        return Response(result)


class AdaptationIndexView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = AdaptationIndexQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        employer = get_object_or_404(Employer, pk=serializer.validated_data["employer_id"])
        period = None
        period_id = serializer.validated_data.get("period_id")
        if period_id is not None:
            period = get_object_or_404(ReviewPeriod, pk=period_id)
        try:
            result = adaptation_index(
                employer=employer,
                period=period,
                skill_type=serializer.validated_data["skills_type"],
            )
        except ServiceError as error:
            return _service_error_response(error)
        return Response(result)


class TaskGoalCreateView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = TaskGoalCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        creator = get_object_or_404(Employer, pk=serializer.validated_data["creator_id"])
        employer = get_object_or_404(Employer, pk=serializer.validated_data["employer_id"])

        goal_payload = serializer.validated_data.get("goal", {})
        goal_title = goal_payload.get("title", "Untitled Goal")
        goal_description = goal_payload.get("description", "")
        goal_deadline = goal_payload.get("deadline")

        tasks = serializer.validated_data["tasks"]
        service_result = create_goal_with_tasks(
            title=goal_title,
            description=goal_description,
            employer=employer,
            creator=creator,
            deadline=goal_deadline,
            tasks_payload=tasks,
        )

        goal = service_result["goal"]
        created_tasks = service_result["tasks"]

        payload = []
        for task in created_tasks:
            review_start = task.end_date
            review_end = review_start + timedelta(days=7)
            payload.append(
                {
                    "task_id": str(task.id),
                    "title": task.title,
                    "review_start": review_start.isoformat(),
                    "review_end": review_end.isoformat(),
                }
            )

        return Response(
            {
                "status": "success",
                "goal_id": str(goal.id),
                "tasks_created": payload,
            },
            status=status.HTTP_201_CREATED,
        )


class TaskReviewTriggerView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = TaskReviewTriggerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        current_date = serializer.get_current_date()
        task = None
        if serializer.validated_data.get("task_id"):
            task = get_object_or_404(ReviewTask, pk=serializer.validated_data["task_id"])
        result = trigger_task_reviews(current_date, task=task)
        return Response({"status": "success", "tasks_initiated": result})


class TaskReviewFormView(APIView):

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get("token")
        if not token:
            return Response(
                {"status": "error", "message": "Token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            payload = fetch_task_form(token)
        except ServiceError as error:
            return _service_error_response(error)
        return Response(payload)


class TaskReviewSubmitView(APIView):

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = TaskReviewSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = submit_task_answers(
                str(serializer.validated_data["token"]),
                serializer.validated_data["answers"],
            )
        except ServiceError as error:
            return _service_error_response(error)
        return Response(result)


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        employer = Employer.objects.filter(user=request.user).first()
        if not employer:
            return Response({"results": [], "unread_count": 0})

        only_unread_raw = request.query_params.get("only_unread")
        only_unread = str(only_unread_raw).lower() in {"1", "true", "yes", "on"}
        limit_param = request.query_params.get("limit")
        try:
            limit = max(int(limit_param), 0) if limit_param is not None else 20
        except (TypeError, ValueError):
            limit = 20

        queryset = SiteNotification.objects.filter(recipient=employer).order_by("-created_at")
        if only_unread:
            queryset = queryset.filter(is_read=False)

        unread_count = SiteNotification.objects.filter(recipient=employer, is_read=False).count()
        notifications = list(queryset[:limit])
        serializer = NotificationSerializer(notifications, many=True)

        return Response({
            "results": serializer.data,
            "unread_count": unread_count,
        })


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id):
        employer = Employer.objects.filter(user=request.user).first()
        if not employer:
            return Response({"detail": "Profile not linked"}, status=status.HTTP_404_NOT_FOUND)

        notification = get_object_or_404(SiteNotification, id=notification_id, recipient=employer)
        notification.mark_read()
        return Response({"status": "success", "notification_id": str(notification.id)})


class NotificationMarkAllView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        employer = Employer.objects.filter(user=request.user).first()
        if not employer:
            return Response({"status": "success", "updated": 0})

        now = timezone.now()
        updated = SiteNotification.objects.filter(recipient=employer, is_read=False).update(
            is_read=True,
            read_at=now,
            updated_at=now,
        )
        return Response({"status": "success", "updated": updated})
