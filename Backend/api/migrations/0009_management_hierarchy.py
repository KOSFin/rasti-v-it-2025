from django.db import migrations, models
import django.db.models.deletion


def create_default_organization(apps, schema_editor):
    Organization = apps.get_model('api', 'Organization')
    Department = apps.get_model('api', 'Department')

    default_org, _ = Organization.objects.get_or_create(
        name='Основная организация',
        defaults={'description': 'Организация по умолчанию'},
    )
    Department.objects.filter(organization__isnull=True).update(organization=default_org)


def bootstrap_role_assignments(apps, schema_editor):
    Employee = apps.get_model('api', 'Employee')
    EmployeeRoleAssignment = apps.get_model('api', 'EmployeeRoleAssignment')

    leadership_employees = Employee.objects.filter(is_manager=True, department__isnull=False)
    for employee in leadership_employees.iterator():
        department = employee.department
        organization = department.organization if department else None
        if not department:
            continue
        EmployeeRoleAssignment.objects.get_or_create(
            employee=employee,
            role='department_head',
            organization=organization,
            department=department,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_repair_employee_position_schema'),
    ]

    operations = [
        migrations.CreateModel(
            name='Organization',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, unique=True)),
                ('description', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={'ordering': ['name']},
        ),
        migrations.AddField(
            model_name='department',
            name='organization',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='departments', to='api.organization'),
        ),
        migrations.AddField(
            model_name='department',
            name='parent',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='children', to='api.department'),
        ),
        migrations.CreateModel(
            name='Team',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='teams', to='api.department')),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='subteams', to='api.team')),
            ],
            options={
                'ordering': ['department__name', 'name'],
                'unique_together': {('department', 'name')},
            },
        ),
        migrations.AddField(
            model_name='employee',
            name='team',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='members', to='api.team'),
        ),
        migrations.CreateModel(
            name='EmployeeRoleAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[
                    ('organization_lead', 'Руководитель организации'),
                    ('department_head', 'Руководитель отдела'),
                    ('team_lead', 'Руководитель команды'),
                    ('position_lead', 'Руководитель должности'),
                    ('mentor', 'Наставник'),
                    ('buddy', 'Бадди'),
                ], max_length=50)),
                ('is_active', models.BooleanField(default=True)),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('department', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='role_assignments', to='api.department')),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='role_assignments', to='api.employee')),
                ('organization', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='role_assignments', to='api.organization')),
                ('position', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='role_assignments', to='api.departmentposition')),
                ('target_employee', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='support_assignments', to='api.employee')),
                ('team', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='role_assignments', to='api.team')),
            ],
            options={
                'ordering': ['employee', 'role', 'assigned_at'],
                'unique_together': {('employee', 'role', 'organization', 'department', 'team', 'position', 'target_employee')},
            },
        ),
        migrations.AddIndex(
            model_name='employeeroleassignment',
            index=models.Index(fields=['role', 'is_active'], name='employee_role_active_idx'),
        ),
        migrations.RunPython(create_default_organization, migrations.RunPython.noop),
        migrations.RunPython(bootstrap_role_assignments, migrations.RunPython.noop),
    ]
