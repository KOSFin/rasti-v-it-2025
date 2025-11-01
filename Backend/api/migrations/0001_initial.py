# Generated manually to align with existing Django models.
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Department",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
            ],
        ),
        migrations.CreateModel(
            name="Employee",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("position", models.CharField(max_length=200)),
                ("is_manager", models.BooleanField(default=False)),
                ("hire_date", models.DateField()),
                (
                    "department",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="api.department",
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Goal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("creator_type", models.CharField(choices=[("self", "Сотрудник"), ("manager", "Руководитель")], default="self", max_length=20)),
                ("title", models.CharField(max_length=300)),
                ("description", models.TextField()),
                ("goal_type", models.CharField(choices=[("strategic", "Стратегическая цель"), ("tactical", "Тактическая задача"), ("personal", "Личное развитие")], max_length=20)),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
                ("expected_results", models.TextField()),
                ("task_link", models.URLField(blank=True)),
                ("requires_evaluation", models.BooleanField(default=False)),
                ("is_completed", models.BooleanField(default=False)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("evaluation_launched", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_goals",
                        to="api.employee",
                    ),
                ),
                (
                    "employee",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="goals", to="api.employee"),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="GoalEvaluationNotification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_read", models.BooleanField(default=False)),
                ("is_completed", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "goal",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="evaluation_notifications", to="api.goal"),
                ),
                (
                    "recipient",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="evaluation_notifications", to="api.employee"),
                ),
            ],
            options={"ordering": ["-created_at"], "unique_together": {("recipient", "goal")}},
        ),
        migrations.CreateModel(
            name="PotentialAssessment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("professional_qualities", models.JSONField(default=list)),
                ("personal_qualities", models.JSONField(default=list)),
                ("needed_motivation", models.BooleanField(default=False)),
                ("communication_issues", models.BooleanField(default=False)),
                (
                    "development_desire",
                    models.CharField(
                        choices=[
                            ("proactive", "Да, хочет развиваться и проактивно себя ведет"),
                            ("needs_help", "Да, хочет развиваться, но нужна помощь менеджера/HR"),
                            ("unsure", "Не уверен, что есть желание развиваться"),
                            ("no_desire", "Не хочет"),
                        ],
                        max_length=20,
                    ),
                ),
                ("is_successor", models.BooleanField(default=False)),
                ("successor_readiness", models.CharField(blank=True, choices=[("1-2", "через 1-2 года"), ("3", "через 3 года"), ("3+", "через 3 и более лет")], max_length=3)),
                ("retention_risk", models.IntegerField(choices=[(i, i) for i in range(11)])),
                ("performance_score", models.IntegerField(default=0)),
                ("potential_score", models.IntegerField(default=0)),
                ("nine_box_x", models.IntegerField(blank=True, null=True)),
                ("nine_box_y", models.IntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "employee",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="potential_assessments", to="api.employee"),
                ),
                (
                    "manager",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="api.employee"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="SelfAssessment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("achieved_results", models.TextField()),
                ("personal_contribution", models.TextField()),
                ("skills_acquired", models.TextField()),
                ("improvements_needed", models.TextField()),
                ("collaboration_quality", models.IntegerField(choices=[(i, i) for i in range(11)])),
                ("satisfaction_score", models.IntegerField(choices=[(i, i) for i in range(11)])),
                ("calculated_score", models.IntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "employee",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="api.employee"),
                ),
                (
                    "goal",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="self_assessments", to="api.goal"),
                ),
            ],
            options={"unique_together": {("employee", "goal")}},
        ),
        migrations.CreateModel(
            name="Task",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=300)),
                ("description", models.TextField()),
                ("is_completed", models.BooleanField(default=False)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("order", models.IntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "goal",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tasks", to="api.goal"),
                ),
            ],
            options={"ordering": ["order", "created_at"]},
        ),
        migrations.CreateModel(
            name="Feedback360",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("results_achievement", models.IntegerField(choices=[(i, i) for i in range(11)])),
                ("personal_qualities", models.TextField()),
                ("collaboration_quality", models.IntegerField(choices=[(i, i) for i in range(11)])),
                ("improvements_suggested", models.TextField()),
                ("calculated_score", models.IntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "assessor",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="given_feedbacks", to="api.employee"),
                ),
                (
                    "employee",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="received_feedbacks", to="api.employee"),
                ),
                (
                    "goal",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="feedbacks", to="api.goal"),
                ),
            ],
            options={"unique_together": {("assessor", "employee", "goal")}},
        ),
        migrations.CreateModel(
            name="ManagerReview",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("results_achievement", models.IntegerField(choices=[(i, i) for i in range(11)])),
                ("personal_qualities_feedback", models.TextField()),
                ("personal_contribution_feedback", models.TextField()),
                ("collaboration_quality", models.IntegerField(choices=[(i, i) for i in range(11)])),
                ("improvements_recommended", models.TextField()),
                ("overall_rating", models.IntegerField(choices=[(i, i) for i in range(11)])),
                ("calculated_score", models.IntegerField(default=0)),
                ("feedback_summary", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "employee",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="received_reviews", to="api.employee"),
                ),
                (
                    "goal",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="manager_reviews", to="api.goal"),
                ),
                (
                    "manager",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="given_reviews", to="api.employee"),
                ),
            ],
            options={"unique_together": {("manager", "employee", "goal")}},
        ),
        migrations.CreateModel(
            name="FinalReview",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("review_period", models.CharField(max_length=50)),
                ("self_assessment_score", models.IntegerField(default=0)),
                ("feedback_360_score", models.IntegerField(default=0)),
                ("manager_review_score", models.IntegerField(default=0)),
                ("potential_score", models.IntegerField(default=0)),
                ("total_score", models.IntegerField(default=0)),
                (
                    "salary_recommendation",
                    models.CharField(
                        choices=[
                            ("exclude", "Не включать в salary increase"),
                            ("conditional", "Включить при наличии критериев"),
                            ("include", "Включить в salary increase"),
                        ],
                        max_length=20,
                    ),
                ),
                ("development_plan", models.TextField()),
                ("manager_summary", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "employee",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="api.employee"),
                ),
            ],
        ),
    ]
