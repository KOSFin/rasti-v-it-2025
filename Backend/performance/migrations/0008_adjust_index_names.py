from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("performance", "0007_seed_default_skills_and_periods"),
    ]

    operations = [
        # ReviewLog index names
        migrations.RemoveIndex(
            model_name="reviewlog",
            name="performance_reviewlog_context_status_idx",
        ),
        migrations.RemoveIndex(
            model_name="reviewlog",
            name="performance_reviewlog_token_idx",
        ),
        migrations.AddIndex(
            model_name="reviewlog",
            index=models.Index(fields=["context", "status"], name="perf_revlog_ctx_status_idx"),
        ),
        migrations.AddIndex(
            model_name="reviewlog",
            index=models.Index(fields=["token"], name="perf_revlog_token_idx"),
        ),

        # SiteNotification index names
        migrations.RemoveIndex(
            model_name="sitenotification",
            name="performance_notification_recipient_idx",
        ),
        migrations.RemoveIndex(
            model_name="sitenotification",
            name="performance_notification_context_idx",
        ),
        migrations.AddIndex(
            model_name="sitenotification",
            index=models.Index(fields=["recipient", "is_read"], name="perf_notif_recipient_idx"),
        ),
        migrations.AddIndex(
            model_name="sitenotification",
            index=models.Index(fields=["context"], name="perf_notif_context_idx"),
        ),

        # TeamRelation index name
        migrations.RemoveIndex(
            model_name="teamrelation",
            name="performance_team_relation_employer_idx",
        ),
        migrations.AddIndex(
            model_name="teamrelation",
            index=models.Index(fields=["employer"], name="perf_team_rel_emp_idx"),
        ),

        # TaskReviewAnswer index names
        migrations.RemoveIndex(
            model_name="taskreviewanswer",
            name="performance_task_answer_task_resp_idx",
        ),
        migrations.RemoveIndex(
            model_name="taskreviewanswer",
            name="performance_task_answer_task_employer_idx",
        ),
        migrations.AddIndex(
            model_name="taskreviewanswer",
            index=models.Index(fields=["task", "respondent"], name="perf_task_answ_resp_idx"),
        ),
        migrations.AddIndex(
            model_name="taskreviewanswer",
            index=models.Index(fields=["task", "employer"], name="perf_task_answ_emp_idx"),
        ),
    ]
