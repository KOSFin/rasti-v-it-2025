import uuid

import performance.models
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
            name="Employer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("fio", models.CharField(max_length=255)),
                ("birthday", models.DateField(blank=True, null=True)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("date_of_employment", models.DateField()),
                ("date_of_dismissal", models.DateField(blank=True, null=True)),
                ("position", models.CharField(max_length=255)),
                (
                    "user",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="employer_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["fio"],
            },
        ),
        migrations.CreateModel(
            name="ReviewPeriod",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("month_period", models.PositiveIntegerField(help_text="Number of months since the employment date")),
                ("name", models.CharField(blank=True, default="", max_length=100)),
                ("start_date", models.DateField(blank=True, null=True)),
                ("end_date", models.DateField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ["month_period"],
                "unique_together": {("month_period", "name")},
            },
        ),
        migrations.CreateModel(
            name="SkillCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("skill_type", models.CharField(choices=[("hard", "Hard skill"), ("soft", "Soft skill")], max_length=10)),
                ("name", models.CharField(max_length=150)),
                ("description", models.TextField(blank=True)),
            ],
            options={
                "ordering": ["skill_type", "name"],
                "unique_together": {("skill_type", "name")},
            },
        ),
        migrations.CreateModel(
            name="ReviewGoal",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("deadline", models.DateField(blank=True, null=True)),
                ("status", models.CharField(choices=[("active", "Active"), ("review", "In review"), ("done", "Done")], default="active", max_length=20)),
                (
                    "creator",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_goals",
                        to="performance.employer",
                    ),
                ),
                (
                    "employer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="goals",
                        to="performance.employer",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="ReviewLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("context", models.CharField(choices=[("skill", "Skill review"), ("task", "Task review"), ("goal", "Goal review")], default="skill", max_length=10)),
                ("question_type", models.CharField(blank=True, max_length=10)),
                ("token", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("expires_at", models.DateTimeField(default=performance.models.default_token_expiry)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("completed", "Completed"),
                            ("expired", "Expired"),
                            ("pending_email", "Pending email"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("email_sent", models.BooleanField(default=False)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                (
                    "employer",
                    models.ForeignKey(
                        help_text="Employee under assessment",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="review_logs",
                        to="performance.employer",
                    ),
                ),
                (
                    "period",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="logs",
                        to="performance.reviewperiod",
                    ),
                ),
                (
                    "respondent",
                    models.ForeignKey(
                        help_text="Reviewer who provides feedback",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assigned_reviews",
                        to="performance.employer",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["context", "status"], name="performance_reviewlog_context_status_idx"),
                    models.Index(fields=["token"], name="performance_reviewlog_token_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ReviewQuestion",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("context", models.CharField(choices=[("task", "Task"), ("goal", "Goal"), ("skill", "Skill")], max_length=10)),
                ("role", models.CharField(blank=True, max_length=120)),
                ("category", models.CharField(max_length=150)),
                ("question_text", models.TextField()),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ["context", "category", "question_text"],
            },
        ),
        migrations.CreateModel(
            name="ReviewTask",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
                ("status", models.CharField(choices=[("active", "Active"), ("review", "In review"), ("completed", "Completed")], default="active", max_length=20)),
                ("priority", models.PositiveIntegerField(default=0)),
                (
                    "goal",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tasks",
                        to="performance.reviewgoal",
                    ),
                ),
            ],
            options={
                "ordering": ["-end_date", "title"],
            },
        ),
        migrations.CreateModel(
            name="SkillQuestion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("question_text", models.TextField()),
                ("grade_description", models.TextField()),
                ("is_active", models.BooleanField(default=True)),
                (
                    "category",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="questions",
                        to="performance.skillcategory",
                    ),
                ),
            ],
            options={
                "ordering": ["category", "created_at"],
            },
        ),
        migrations.CreateModel(
            name="ReviewSchedule",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("context", models.CharField(choices=[("skill", "Skill review"), ("task", "Task review"), ("goal", "Goal review")], max_length=10)),
                ("review_start", models.DateField()),
                ("review_end", models.DateField()),
                ("status", models.CharField(choices=[("pending", "Pending"), ("in_progress", "In progress"), ("completed", "Completed")], default="pending", max_length=20)),
                (
                    "related_goal",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="schedules",
                        to="performance.reviewgoal",
                    ),
                ),
                (
                    "related_task",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="schedules",
                        to="performance.reviewtask",
                    ),
                ),
            ],
            options={
                "ordering": ["review_start"],
            },
        ),
        migrations.CreateModel(
            name="ReviewAnswer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("question_type", models.CharField(choices=[("hard", "Hard skill"), ("soft", "Soft skill")], max_length=10)),
                ("grade", models.PositiveSmallIntegerField(default=0)),
                (
                    "employer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="answers_as_employee",
                        to="performance.employer",
                    ),
                ),
                (
                    "period",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="answers",
                        to="performance.reviewperiod",
                    ),
                ),
                (
                    "question",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="answers",
                        to="performance.skillquestion",
                    ),
                ),
                (
                    "respondent",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="answers_as_respondent",
                        to="performance.employer",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["employer", "period"], name="performance_answer_employer_period_idx"),
                    models.Index(fields=["respondent", "period"], name="performance_answer_respondent_period_idx"),
                ],
                "unique_together": {("employer", "respondent", "period", "question")},
            },
        ),
        migrations.CreateModel(
            name="TaskReviewAnswer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("grade", models.PositiveSmallIntegerField(default=0)),
                (
                    "employer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="task_reviews_as_employee",
                        to="performance.employer",
                    ),
                ),
                (
                    "question",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="task_answers",
                        to="performance.reviewquestion",
                    ),
                ),
                (
                    "respondent",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="task_reviews_as_respondent",
                        to="performance.employer",
                    ),
                ),
                (
                    "task",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="answers",
                        to="performance.reviewtask",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["task", "respondent"], name="performance_task_answer_task_resp_idx"),
                    models.Index(fields=["task", "employer"], name="performance_task_answer_task_employer_idx"),
                ],
                "unique_together": {("task", "employer", "respondent", "question")},
            },
        ),
        migrations.CreateModel(
            name="TeamRelation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "employer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="team_memberships",
                        to="performance.employer",
                    ),
                ),
                (
                    "peer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="peer_memberships",
                        to="performance.employer",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["employer"], name="performance_team_relation_employer_idx"),
                ],
                "unique_together": {("employer", "peer")},
            },
        ),
        migrations.CreateModel(
            name="SiteNotification",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=255)),
                ("message", models.TextField()),
                (
                    "context",
                    models.CharField(
                        choices=[
                            ("skill", "Skill review"),
                            ("task", "Task review"),
                            ("goal", "Goal review"),
                            ("general", "General"),
                        ],
                        default="general",
                        max_length=20,
                    ),
                ),
                ("link", models.CharField(blank=True, max_length=500)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("is_read", models.BooleanField(default=False)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                (
                    "recipient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to="performance.employer",
                    ),
                ),
                (
                    "related_log",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to="performance.reviewlog",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["recipient", "is_read"], name="performance_notification_recipient_idx"),
                    models.Index(fields=["context"], name="performance_notification_context_idx"),
                ],
            },
        ),
    ]
