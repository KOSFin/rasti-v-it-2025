from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("performance", "0002_rename_performance_answer_employer_period_idx_perf_answ_emp_period_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="employer",
            name="activation_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="skillquestion",
            name="weight",
            field=models.PositiveIntegerField(default=1, help_text="Weight multiplier for aggregated scores"),
        ),
    ]
