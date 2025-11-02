from django.contrib import admin

from .models import SkillCategory, SkillQuestion, ReviewPeriod


class SkillQuestionInline(admin.TabularInline):
	model = SkillQuestion
	extra = 1
	fields = ("question_text", "grade_description", "weight", "is_active")
	show_change_link = True


@admin.register(SkillCategory)
class SkillCategoryAdmin(admin.ModelAdmin):
	list_display = ("name", "skill_type", "description")
	list_filter = ("skill_type",)
	search_fields = ("name", "description")
	inlines = [SkillQuestionInline]


@admin.register(SkillQuestion)
class SkillQuestionAdmin(admin.ModelAdmin):
	list_display = ("category", "short_text", "weight", "is_active", "updated_at")
	list_filter = ("category__skill_type", "category", "is_active")
	search_fields = ("question_text", "grade_description", "category__name")
	autocomplete_fields = ("category",)

	def short_text(self, obj):
		return (obj.question_text or "").strip()[:80]


@admin.register(ReviewPeriod)
class ReviewPeriodAdmin(admin.ModelAdmin):
	list_display = ("name", "month_period", "is_active", "start_date", "end_date")
	list_filter = ("is_active",)
	search_fields = ("name",)
