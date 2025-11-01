# Generated manually for role system and group goals.
from django.db import migrations, models
import django.db.models.deletion


def populate_roles_and_participants(apps, schema_editor):
    Employee = apps.get_model('api', 'Employee')
    Goal = apps.get_model('api', 'Goal')
    GoalParticipant = apps.get_model('api', 'GoalParticipant')

    # Обновляем роли сотрудников на основе текущих флагов и статусов пользователей
    for employee in Employee.objects.select_related('user').all():
        role = employee.role or 'employee'
        if employee.user_id and employee.user.is_superuser:
            role = 'admin'
        elif employee.is_manager:
            role = 'manager'
        elif role not in {'admin', 'manager', 'business_partner', 'employee'}:
            role = 'employee'

        title = employee.position_title or 'Сотрудник'
        Employee.objects.filter(pk=employee.pk).update(role=role, position_title=title)

    # Добавляем владельцев целей в таблицу GoalParticipant
    for goal in Goal.objects.select_related('employee').all():
        if goal.employee_id:
            GoalParticipant.objects.get_or_create(
                goal_id=goal.pk,
                employee_id=goal.employee_id,
                defaults={'is_owner': True},
            )


def revert_roles_and_participants(apps, schema_editor):
    """Нет необходимости откатывать, оставляем данные как есть."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='DepartmentPosition',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('importance', models.PositiveIntegerField(default=0)),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='positions', to='api.department')),
            ],
            options={
                'ordering': ['importance', 'id'],
                'unique_together': {('department', 'title')},
            },
        ),
        migrations.RenameField(
            model_name='employee',
            old_name='position',
            new_name='position_title',
        ),
        migrations.AddField(
            model_name='employee',
            name='position',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='employees', to='api.departmentposition'),
        ),
        migrations.AlterField(
            model_name='employee',
            name='position_title',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='employee',
            name='role',
            field=models.CharField(choices=[('admin', 'Суперпользователь'), ('manager', 'Менеджер'), ('business_partner', 'Бизнес-партнер'), ('employee', 'Сотрудник')], default='employee', max_length=32),
        ),
        migrations.CreateModel(
            name='GoalParticipant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_owner', models.BooleanField(default=False)),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='goal_participants', to='api.employee')),
                ('goal', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='goal_participants', to='api.goal')),
            ],
            options={
                'unique_together': {('goal', 'employee')},
            },
        ),
        migrations.AddField(
            model_name='goal',
            name='participants',
            field=models.ManyToManyField(related_name='goals', through='api.GoalParticipant', to='api.employee'),
        ),
        migrations.AddField(
            model_name='task',
            name='completed_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tasks_completed', to='api.employee'),
        ),
        migrations.RunPython(populate_roles_and_participants, revert_roles_and_participants),
    ]
