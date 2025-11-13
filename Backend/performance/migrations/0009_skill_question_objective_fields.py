from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0010_assessment_ai_refactor"),
        ("performance", "0008_adjust_index_names"),
    ]

    operations = [
        migrations.AddField(
            model_name="skillquestion",
            name="answer_options",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="skillquestion",
            name="answer_type",
            field=models.CharField(
                choices=[
                    ("scale", "Шкала"),
                    ("numeric", "Числовой ответ"),
                    ("single_choice", "Один вариант"),
                    ("boolean", "Да/Нет"),
                ],
                default="scale",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="skillquestion",
            name="context",
            field=models.CharField(
                choices=[
                    ("self", "Самооценка"),
                    ("peer", "Оценка 360"),
                    ("both", "Самооценка и 360"),
                ],
                default="both",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="skillquestion",
            name="correct_answer",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="skillquestion",
            name="departments",
            field=models.ManyToManyField(
                blank=True,
                help_text="Если не выбрано ни одного отдела, вопрос доступен для всех",
                related_name="skill_questions",
                to="api.department",
            ),
        ),
        migrations.AddField(
            model_name="skillquestion",
            name="difficulty",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="skillquestion",
            name="tolerance",
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name="skillquestion",
            name="scale_max",
            field=models.PositiveSmallIntegerField(default=10),
        ),
        migrations.AddField(
            model_name="skillquestion",
            name="scale_min",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="reviewanswer",
            name="answer_value",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="reviewanswer",
            name="is_correct",
            field=models.BooleanField(blank=True, null=True),
        ),
    ]
