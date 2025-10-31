"""REST endpoints for the Performance Review module."""

from datetime import date, timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Employer, ReviewGoal, ReviewPeriod, ReviewTask, SiteNotification
from .serializers import (
    AdaptationIndexQuerySerializer,
    AnalyticsQuerySerializer,
    NotificationSerializer,
    ReviewCycleTriggerSerializer,
    ReviewSubmitSerializer,
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
    review_analytics,
    submit_skill_answers,
    submit_task_answers,
    trigger_task_reviews,
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
    """API #1 — initiate performance review cycles."""

    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        serializer = ReviewCycleTriggerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        current_date = serializer.get_current_date()
        result = generate_skill_review_cycles(current_date)
        return Response({"status": "success", **result})


class ReviewFormView(APIView):
    """API #3 — fetch review form via one-time token."""

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
    """API #2 — accept answers for a review cycle."""

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
    """API #4 — aggregated analytics for an employer."""

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


class AdaptationIndexView(APIView):
    """API #5 — calculate adaptation index."""

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
    """Task/Goal API #1 — create goal and tasks."""

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
    """Task/Goal API #2 — trigger task review cycles."""

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
    """Task/Goal API #3 — fetch task review form."""

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
    """Task/Goal API #4 — submit task review answers."""

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
