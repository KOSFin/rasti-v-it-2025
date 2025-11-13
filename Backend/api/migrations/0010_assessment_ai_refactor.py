import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_management_hierarchy'),
    ]

    operations = [
        migrations.AlterField(
            model_name='feedback360',
            name='improvements_suggested',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='feedback360',
            name='personal_qualities',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='feedback360',
            name='objective_answers',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='feedback360',
            name='score_breakdown',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='potentialassessment',
            name='score_breakdown',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name='selfassessment',
            name='achieved_results',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='selfassessment',
            name='collaboration_quality',
            field=models.IntegerField(choices=[(i, i) for i in range(11)], default=0),
        ),
        migrations.AlterField(
            model_name='selfassessment',
            name='improvements_needed',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='selfassessment',
            name='personal_contribution',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='selfassessment',
            name='satisfaction_score',
            field=models.IntegerField(choices=[(i, i) for i in range(11)], default=0),
        ),
        migrations.AlterField(
            model_name='selfassessment',
            name='skills_acquired',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='selfassessment',
            name='objective_answers',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='selfassessment',
            name='score_breakdown',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.CreateModel(
            name='NineBoxSnapshot',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('scope', models.CharField(default='global', max_length=64)),
                ('generated_at', models.DateTimeField(auto_now_add=True)),
                ('valid_until', models.DateTimeField()),
                ('source', models.CharField(choices=[('scheduled', 'Плановое обновление'), ('on_demand', 'Запрос пользователя')], default='on_demand', max_length=20)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('stats', models.JSONField(blank=True, default=dict)),
                ('ai_recommendations', models.JSONField(blank=True, default=list)),
                ('generated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='nine_box_snapshots', to='api.employee')),
            ],
            options={'ordering': ['-generated_at']},
        ),
        migrations.CreateModel(
            name='AssessmentQuestionTemplate',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('context', models.CharField(choices=[('self', 'Самооценка'), ('feedback_360', 'Оценка 360')], max_length=20)),
                ('category', models.CharField(blank=True, max_length=120)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('answer_type', models.CharField(choices=[('scale', 'Шкала'), ('numeric', 'Числовой ответ'), ('single_choice', 'Выбор одного варианта'), ('boolean', 'Да/Нет')], max_length=20)),
                ('answer_options', models.JSONField(blank=True, default=list)),
                ('correct_answer', models.JSONField(blank=True, null=True)),
                ('max_score', models.PositiveIntegerField(default=10)),
                ('weight', models.PositiveIntegerField(default=1)),
                ('tolerance', models.FloatField(default=0)),
                ('order', models.PositiveIntegerField(default=0)),
                ('complexity', models.CharField(blank=True, default='', max_length=30)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_assessment_questions', to='api.employee')),
                ('department', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='assessment_questions', to='api.department')),
            ],
            options={'ordering': ['context', 'department_id', 'order', 'created_at']},
        ),
        migrations.AddIndex(
            model_name='assessmentquestiontemplate',
            index=models.Index(fields=['context', 'department_id'], name='assessment_q_context_dept_idx'),
        ),
        migrations.AddIndex(
            model_name='assessmentquestiontemplate',
            index=models.Index(fields=['context', 'order'], name='assessment_q_context_order_idx'),
        ),
        migrations.AddIndex(
            model_name='nineboxsnapshot',
            index=models.Index(fields=['scope', 'valid_until'], name='ninebox_scope_valid_idx'),
        ),
        migrations.AddIndex(
            model_name='nineboxsnapshot',
            index=models.Index(fields=['generated_at'], name='ninebox_generated_idx'),
        ),
    ]