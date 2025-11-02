"""
Seed default hard/soft skill categories and questions for skill reviews.

Usage:
  python manage.py seed_skill_questions
  python manage.py seed_skill_questions --reset  # deletes existing questions/categories first
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from performance.models import SkillCategory, SkillQuestion


DEFAULT_CATEGORIES = (
    (SkillCategory.HARD, "Hard skills"),
    (SkillCategory.SOFT, "Soft skills"),
)

DEFAULT_QUESTIONS = {
    SkillCategory.HARD: [
        ("Знание технологий и инструментов", "1 — нет опыта; 10 — эксперт и ментор"),
        ("Качество кода и архитектурные решения", "1 — много дефектов; 10 — продуманные решения, минимум дефектов"),
        ("Производительность и эффективность", "1 — медленно, низкая автономность; 10 — быстро и эффективно"),
    ],
    SkillCategory.SOFT: [
        ("Коммуникация и прозрачность", "1 — проблемы в коммуникации; 10 — ясная, регулярная и вовлекающая коммуникация"),
        ("Командное взаимодействие", "1 — работает изолированно; 10 — поддерживает и развивает команду"),
        ("Ответственность и надежность", "1 — нарушает договоренности; 10 — стабильно выполняет обязательства"),
    ],
}


class Command(BaseCommand):
    help = "Создать базовые категории и вопросы для оценок навыков (шкала 1-10)"

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Удалить существующие категории/вопросы перед созданием")

    @transaction.atomic
    def handle(self, *args, **options):
        do_reset = bool(options.get("reset"))
        if do_reset:
            self.stdout.write("Удаление существующих вопросов и категорий…")
            SkillQuestion.objects.all().delete()
            SkillCategory.objects.all().delete()

        created_cats = 0
        created_qs = 0

        for skill_type, cat_name in DEFAULT_CATEGORIES:
            category, created = SkillCategory.objects.get_or_create(
                skill_type=skill_type,
                name=cat_name,
                defaults={"description": ""},
            )
            if created:
                created_cats += 1

            for text, desc in DEFAULT_QUESTIONS[skill_type]:
                _, q_created = SkillQuestion.objects.get_or_create(
                    category=category,
                    question_text=text,
                    defaults={
                        "grade_description": desc,
                        "weight": 1,
                        "is_active": True,
                    },
                )
                if q_created:
                    created_qs += 1

        self.stdout.write(self.style.SUCCESS(
            f"Готово. Создано категорий: {created_cats}, вопросов: {created_qs}."
        ))
