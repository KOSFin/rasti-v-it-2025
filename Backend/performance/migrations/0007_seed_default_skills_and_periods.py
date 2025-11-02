from django.db import migrations
from django.utils import timezone


def ensure_periods(apps, schema_editor):
    ReviewPeriod = apps.get_model('performance', 'ReviewPeriod')
    defaults = [
        (0, 'Старт'),
        (1, '1 месяц'),
        (3, '3 месяца'),
        (6, '6 месяцев'),
        (12, '12 месяцев'),
        (24, '24 месяца'),
    ]
    for month, name in defaults:
        period, created = ReviewPeriod.objects.get_or_create(
            month_period=month,
            defaults={'name': name, 'is_active': True, 'start_date': None, 'end_date': None},
        )
        update_fields = []
        if period.name != name and name:
            period.name = name
            update_fields.append('name')
        if period.is_active is False:
            period.is_active = True
            update_fields.append('is_active')
        if update_fields:
            update_fields.append('updated_at')
            period.save(update_fields=update_fields)


def seed_skill_qs(apps, schema_editor):
    SkillCategory = apps.get_model('performance', 'SkillCategory')
    SkillQuestion = apps.get_model('performance', 'SkillQuestion')

    hard_cat, _ = SkillCategory.objects.get_or_create(
        skill_type='hard', name='Hard skills', defaults={'description': ''}
    )
    soft_cat, _ = SkillCategory.objects.get_or_create(
        skill_type='soft', name='Soft skills', defaults={'description': ''}
    )

    hard_questions = [
        ("Знание технологий и инструментов", "1 — нет опыта; 10 — эксперт и ментор"),
        ("Качество кода и архитектурные решения", "1 — много дефектов; 10 — продуманные решения, минимум дефектов"),
        ("Производительность и эффективность", "1 — медленно, низкая автономность; 10 — быстро и эффективно"),
    ]
    soft_questions = [
        ("Коммуникация и прозрачность", "1 — проблемы в коммуникации; 10 — ясная, регулярная и вовлекающая коммуникация"),
        ("Командное взаимодействие", "1 — работает изолированно; 10 — поддерживает и развивает команду"),
        ("Ответственность и надежность", "1 — нарушает договоренности; 10 — стабильно выполняет обязательства"),
    ]

    # weight field exists since migration 0003
    for text, desc in hard_questions:
        SkillQuestion.objects.get_or_create(
            category=hard_cat,
            question_text=text,
            defaults={'grade_description': desc, 'weight': 1, 'is_active': True},
        )
    for text, desc in soft_questions:
        SkillQuestion.objects.get_or_create(
            category=soft_cat,
            question_text=text,
            defaults={'grade_description': desc, 'weight': 1, 'is_active': True},
        )


def backfill_available_since(apps, schema_editor):
    ReviewLog = apps.get_model('performance', 'ReviewLog')
    Employer = apps.get_model('performance', 'Employer')
    ReviewPeriod = apps.get_model('performance', 'ReviewPeriod')

    # Get zero period if exists
    zero_period = ReviewPeriod.objects.filter(month_period=0).first()

    qs = ReviewLog.objects.filter(context='skill', status__in=['pending', 'pending_email'])
    for log in qs.iterator():
        md = dict(log.metadata or {})
        if 'available_since' in md:
            continue
        employer = Employer.objects.filter(id=log.employer_id).first()
        # Prefer activation_date, then date_of_employment, then today
        base_date = getattr(employer, 'activation_date', None) or getattr(employer, 'date_of_employment', None)
        if base_date is None:
            base_date = timezone.now().date()
        md['available_since'] = base_date.isoformat()
        # also set due_at if missing for zero period
        if 'due_at' not in md and log.period_id and zero_period and log.period_id == zero_period.id:
            md['due_at'] = base_date.isoformat()
        log.metadata = md
        log.save(update_fields=['metadata', 'updated_at'])


def forwards(apps, schema_editor):
    ensure_periods(apps, schema_editor)
    seed_skill_qs(apps, schema_editor)
    backfill_available_since(apps, schema_editor)


def backwards(apps, schema_editor):
    # Keep periods; do not delete. For questions/categories, we leave data intact.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('performance', '0006_alter_reviewlog_status'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
