"""Serializers for the Performance Review API surface."""

from datetime import date

from rest_framework import serializers

from .models import Employer, ReviewGoal, ReviewTask, SiteNotification


class ReviewCycleTriggerSerializer(serializers.Serializer):
    current_date = serializers.DateField(required=False)

    def get_current_date(self) -> date:
        return self.validated_data.get("current_date") or date.today()


class ReviewAnswerItemSerializer(serializers.Serializer):
    id_question = serializers.IntegerField()
    grade = serializers.IntegerField(min_value=0, max_value=10)


class ReviewSubmitSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    answers = ReviewAnswerItemSerializer(many=True)
    save_mode = serializers.ChoiceField(choices=["full", "partial"], default="full")


class AnalyticsQuerySerializer(serializers.Serializer):
    employer_id = serializers.IntegerField()
    period_id = serializers.IntegerField(required=False)
    skills_type = serializers.ChoiceField(choices=["hard", "soft", "all"], default="all")


class AdaptationIndexQuerySerializer(AnalyticsQuerySerializer):
    pass


class GoalPayloadSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True)
    deadline = serializers.DateField(required=False, allow_null=True)


class TaskPayloadSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    start_date = serializers.DateField()
    end_date = serializers.DateField()

    def validate(self, attrs):
        if attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError("Task end date cannot precede the start date.")
        return attrs


class TaskGoalCreateSerializer(serializers.Serializer):
    creator_id = serializers.IntegerField()
    employer_id = serializers.IntegerField()
    goal = GoalPayloadSerializer(required=False)
    tasks = TaskPayloadSerializer(many=True)

    def validate(self, attrs):
        if not attrs.get("tasks"):
            raise serializers.ValidationError("At least one task should be provided.")
        return attrs


class TaskReviewTriggerSerializer(serializers.Serializer):
    task_id = serializers.UUIDField(required=False)
    current_date = serializers.DateField(required=False)

    def get_current_date(self) -> date:
        return self.validated_data.get("current_date") or date.today()


class TaskReviewAnswerItemSerializer(serializers.Serializer):
    id = serializers.UUIDField(required=False)
    id_question = serializers.UUIDField(required=False)
    grade = serializers.IntegerField(min_value=0, max_value=10)

    def validate(self, attrs):
        if not attrs.get("id") and not attrs.get("id_question"):
            raise serializers.ValidationError("Question identifier is required.")
        return attrs


class TaskReviewSubmitSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    answers = TaskReviewAnswerItemSerializer(many=True)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteNotification
        fields = [
            "id",
            "title",
            "message",
            "context",
            "link",
            "metadata",
            "is_read",
            "created_at",
            "read_at",
            "related_log",
        ]
        read_only_fields = fields
