
from datetime import date

from rest_framework import serializers

from .models import Employer, ReviewGoal, ReviewTask, SiteNotification, SkillQuestion


class ReviewCycleTriggerSerializer(serializers.Serializer):
    current_date = serializers.DateField(required=False)

    def get_current_date(self) -> date:
        return self.validated_data.get("current_date") or date.today()


class ReviewAnswerItemSerializer(serializers.Serializer):
    id_question = serializers.IntegerField()
    grade = serializers.IntegerField(min_value=0, max_value=10, required=False)
    answer = serializers.JSONField(required=False)
    value = serializers.JSONField(required=False)

    def validate(self, attrs):
        if "grade" not in attrs and "answer" not in attrs and "value" not in attrs:
            raise serializers.ValidationError("Необходимо передать grade или answer/value для вопроса.")
        return attrs


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


class SkillReviewFeedbackSubmitSerializer(serializers.Serializer):
    log_id = serializers.IntegerField()
    message = serializers.CharField(min_length=3, max_length=5000)


class SkillReviewQueueItemSerializer(serializers.Serializer):
    log_id = serializers.IntegerField()
    employee_id = serializers.IntegerField()
    employee_name = serializers.CharField()
    period_label = serializers.CharField()
    status = serializers.CharField()
    submitted_at = serializers.DateTimeField(allow_null=True)
    due_date = serializers.DateField()
    days_overdue = serializers.IntegerField()
    score = serializers.FloatField(allow_null=True)
    feedback = serializers.DictField(allow_null=True)
    reputation_penalty = serializers.FloatField()


class SkillQuestionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    skill_type = serializers.CharField(source="category.skill_type", read_only=True)
    context_display = serializers.CharField(source="get_context_display", read_only=True)
    department_options = serializers.SerializerMethodField()

    class Meta:
        model = SkillQuestion
        fields = [
            "id",
            "category",
            "category_name",
            "skill_type",
            "question_text",
            "grade_description",
            "weight",
            "is_active",
            "context",
            "context_display",
            "answer_type",
            "scale_min",
            "scale_max",
            "answer_options",
            "correct_answer",
            "difficulty",
            "tolerance",
            "departments",
            "department_options",
            "created_at",
            "updated_at",
        ]

    def get_department_options(self, obj):
        return [
            {"id": dept.id, "name": dept.name}
            for dept in obj.departments.all()
        ]

    def validate(self, attrs):
        answer_type = attrs.get("answer_type") or getattr(self.instance, "answer_type", SkillQuestion.AnswerType.SCALE)
        scale_min = attrs.get("scale_min", getattr(self.instance, "scale_min", 0))
        scale_max = attrs.get("scale_max", getattr(self.instance, "scale_max", 10))
        answer_options = attrs.get("answer_options", getattr(self.instance, "answer_options", []))
        correct_answer = attrs.get("correct_answer", getattr(self.instance, "correct_answer", None))
        tolerance = attrs.get("tolerance", getattr(self.instance, "tolerance", 0))

        if answer_type == SkillQuestion.AnswerType.SCALE and scale_max <= scale_min:
            raise serializers.ValidationError({"scale_max": "Верхняя граница шкалы должна быть больше минимальной."})

        if answer_type == SkillQuestion.AnswerType.SINGLE_CHOICE:
            if not answer_options or not isinstance(answer_options, list):
                raise serializers.ValidationError({"answer_options": "Для выбора варианта необходимо указать список опций."})
            if correct_answer is not None and correct_answer not in answer_options:
                raise serializers.ValidationError({"correct_answer": "Правильный ответ должен входить в список вариантов."})

        if answer_type == SkillQuestion.AnswerType.NUMERIC and tolerance is not None:
            try:
                float(tolerance)
            except (TypeError, ValueError):
                raise serializers.ValidationError({"tolerance": "Допуск должен быть числом."})

        return attrs
