"""Domain services powering Performance Review workflows."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, Iterable, List, Optional, Tuple, TYPE_CHECKING

from django.db import transaction
from django.db.models import Avg, F, Q
from django.utils import timezone

from .models import (
    Employer,
    ReviewAnswer,
    ReviewGoal,
    ReviewLog,
    ReviewPeriod,
    ReviewQuestion,
    ReviewSchedule,
    ReviewTask,
    SkillCategory,
    SkillQuestion,
    SiteNotification,
    TaskReviewAnswer,
    TeamRelation,
    default_token_expiry,
)

if TYPE_CHECKING:  # pragma: no cover - import only for type hints
    from api.models import Employee


class ServiceError(Exception):
    """Base service layer exception."""

    def __init__(self, message: str, *, code: str = "service_error", status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status


@dataclass
class ReviewCycleResult:
    created_self_tests: int = 0
    created_peer_reviews: int = 0
    notifications_created: int = 0

    def as_dict(self) -> Dict[str, int]:
        return {
            "created_self_tests": self.created_self_tests,
            "created_peer_reviews": self.created_peer_reviews,
            "notifications_created": self.notifications_created,
        }


def months_between(start: date, end: date) -> int:
    """Return the full month difference between two dates."""

    if end < start:
        return -1
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return months


def _is_period_due(period: ReviewPeriod, *, current_date: date, employer: Employer) -> bool:
    if not period.is_active:
        return False
    if period.start_date and current_date < period.start_date:
        return False
    if period.end_date and current_date > period.end_date:
        return False
    return months_between(employer.date_of_employment, current_date) == period.month_period


def _ensure_zero_period() -> ReviewPeriod:
    period, _ = ReviewPeriod.objects.get_or_create(
        month_period=0,
        defaults={"name": "start", "start_date": None, "end_date": None, "is_active": True},
    )
    return period


def _active_employers(as_of: date) -> Iterable[Employer]:
    queryset = Employer.objects.all().order_by("fio")
    active = []
    for employer in queryset:
        if employer.date_of_employment > as_of:
            continue
        if employer.date_of_dismissal and employer.date_of_dismissal <= as_of:
            continue
        active.append(employer)
    return active


def _create_review_log(
    *,
    employer: Employer,
    respondent: Employer,
    period: ReviewPeriod,
    context: str,
    metadata: Optional[Dict] = None,
) -> Tuple[ReviewLog, bool]:
    existing_log = ReviewLog.objects.filter(
        employer=employer,
        respondent=respondent,
        period=period,
        context=context,
        status__in=[ReviewLog.STATUS_PENDING, ReviewLog.STATUS_PENDING_EMAIL],
    ).first()

    if existing_log:
        existing_log.expires_at = default_token_expiry()
        if metadata:
            merged = existing_log.metadata or {}
            merged.update(metadata)
            existing_log.metadata = merged
        existing_log.status = ReviewLog.STATUS_PENDING
        existing_log.save(update_fields=["expires_at", "metadata", "status", "updated_at"])
        created_notification = _ensure_notification_for_log(existing_log)
        return existing_log, created_notification

    new_log = ReviewLog.objects.create(
        employer=employer,
        respondent=respondent,
        period=period,
        context=context,
        metadata=metadata or {},
        status=ReviewLog.STATUS_PENDING_EMAIL,
    )
    created_notification = _ensure_notification_for_log(new_log)
    return new_log, created_notification


def _ensure_notification_for_log(log: ReviewLog) -> bool:
    if log.respondent_id is None:
        return False

    title, message, base_path, extra_meta = _notification_content_for_log(log)
    base_metadata: Dict = {**(log.metadata or {})}
    if extra_meta:
        base_metadata.update(extra_meta)

    base_metadata.setdefault("employer_id", log.employer_id)
    base_metadata.setdefault("respondent_id", log.respondent_id)
    if log.period_id:
        base_metadata.setdefault("period_id", log.period_id)
    base_metadata["token"] = str(log.token)

    notification, created = SiteNotification.objects.update_or_create(
        related_log=log,
        defaults={
            "recipient": log.respondent,
            "title": title,
            "message": message,
            "context": log.context,
            "metadata": base_metadata,
            "is_read": False,
            "read_at": None,
        },
    )

    metadata_with_id = {**base_metadata, "notification_id": str(notification.id)}
    update_fields: List[str] = []

    if notification.metadata != metadata_with_id:
        notification.metadata = metadata_with_id
        update_fields.append("metadata")

    desired_link = _notification_link(log, str(notification.id), base_path)
    if notification.link != desired_link:
        notification.link = desired_link
        update_fields.append("link")

    if update_fields:
        update_fields.append("updated_at")
        notification.save(update_fields=update_fields)
    else:
        notification.save(update_fields=["updated_at"])

    return created


def _notification_content_for_log(log: ReviewLog) -> Tuple[str, str, str, Dict]:
    metadata = log.metadata or {}

    if log.context == ReviewLog.CONTEXT_SKILL:
        review_type = metadata.get("review_type", "peer")
        period_label = _period_label(log.period) if log.period else "текущий период"
        employer_name = log.employer.fio

        if review_type == "self":
            title = "Самооценка компетенций"
            message = f"Обновите самооценку навыков за период {period_label}."
        else:
            title = "Оценка коллеги"
            message = f"Оцените навыки {employer_name} за период {period_label}."

        base_path = "/reviews/skills"
        extra_meta = {"period_label": period_label, "review_type": review_type}
        return title, message, base_path, extra_meta

    if log.context == ReviewLog.CONTEXT_TASK:
        task_title = metadata.get("task_title")
        if not task_title:
            task_id = metadata.get("task_id")
            if task_id:
                task_title = (
                    ReviewTask.objects.filter(id=task_id).values_list("title", flat=True).first()
                )
        task_title = task_title or "поставленной задачи"
        title = f'Оценка задачи "{task_title}"'
        message = f'Пожалуйста, оцените выполнение задачи "{task_title}".'
        base_path = "/reviews/tasks"
        extra_meta = {"task_title": task_title}
        return title, message, base_path, extra_meta

    if log.context == ReviewLog.CONTEXT_GOAL:
        goal_title = metadata.get("goal_title", "поставленной цели")
        title = f'Оценка цели "{goal_title}"'
        message = f'Подтвердите результаты достижения цели "{goal_title}".'
        base_path = "/reviews/goals"
        extra_meta = {"goal_title": goal_title}
        return title, message, base_path, extra_meta

    title = "Новое уведомление"
    message = "Для вас подготовлена форма обратной связи."
    return title, message, "/reviews/skills", {}


def _notification_link(log: ReviewLog, notification_id: str, base_path: str) -> str:
    path = base_path if base_path.startswith("/") else f"/{base_path.lstrip('/')}"
    token = str(log.token)
    if notification_id:
        return f"{path.rstrip('/')}/{token}?notification_id={notification_id}"
    return f"{path.rstrip('/')}/{token}"


def _create_question_placeholders(
    *,
    employer: Employer,
    respondent: Employer,
    period: ReviewPeriod,
    questions: Iterable[SkillQuestion],
) -> Tuple[int, int]:
    answers_created = 0
    unanswered = 0

    for question in questions:
        answer, created = ReviewAnswer.objects.get_or_create(
            employer=employer,
            respondent=respondent,
            period=period,
            question=question,
            defaults={
                "question_type": question.category.skill_type,
                "grade": 0,
            },
        )
        if created:
            answers_created += 1
            unanswered += 1
        else:
            if answer.question_type != question.category.skill_type:
                answer.question_type = question.category.skill_type
                answer.save(update_fields=["question_type", "updated_at"])
            if answer.grade == 0:
                unanswered += 1

    return answers_created, unanswered


def ensure_initial_self_review(employer: Employer) -> Optional[ReviewLog]:
    """Guarantee that a self-review link exists for the employer's zero period."""

    questions = list(
        SkillQuestion.objects.filter(is_active=True)
        .select_related("category")
        .order_by("category__skill_type", "category__name", "id")
    )
    if not questions:
        return None

    zero_period = _ensure_zero_period()

    existing_log = (
        ReviewLog.objects.filter(
            employer=employer,
            respondent=employer,
            period=zero_period,
            context=ReviewLog.CONTEXT_SKILL,
        )
        .order_by("-created_at")
        .first()
    )

    if existing_log and existing_log.status in [ReviewLog.STATUS_PENDING, ReviewLog.STATUS_PENDING_EMAIL]:
        existing_log.expires_at = default_token_expiry()
        existing_log.save(update_fields=["expires_at", "updated_at"])
        _ensure_notification_for_log(existing_log)
        return existing_log

    created_answers, _ = _create_question_placeholders(
        employer=employer,
        respondent=employer,
        period=zero_period,
        questions=questions,
    )

    if not created_answers and existing_log and existing_log.status == ReviewLog.STATUS_COMPLETED:
        return None

    review_log, _ = _create_review_log(
        employer=employer,
        respondent=employer,
        period=zero_period,
        context=ReviewLog.CONTEXT_SKILL,
        metadata={"review_type": "self", "trigger": "first_login"},
    )
    review_log.status = ReviewLog.STATUS_PENDING
    review_log.save(update_fields=["status", "updated_at"])
    return review_log


@transaction.atomic
def generate_skill_review_cycles(current_date: date) -> Dict[str, int]:
    """Create grade=0 placeholders and tokens for self and peer reviews."""

    result = ReviewCycleResult()
    questions = list(SkillQuestion.objects.filter(is_active=True).select_related("category"))
    if not questions:
        return result.as_dict()

    periods = list(ReviewPeriod.objects.filter(is_active=True))
    zero_period = next((p for p in periods if p.month_period == 0), None) or _ensure_zero_period()

    active_employees = list(_active_employers(current_date))
    if not active_employees:
        return result.as_dict()

    for employer in active_employees:
        days_since_hire = (current_date - employer.date_of_employment).days
        if days_since_hire < 0:
            continue

        if days_since_hire == 0:
            created_answers, _ = _create_question_placeholders(
                employer=employer,
                respondent=employer,
                period=zero_period,
                questions=questions,
            )
            if created_answers:
                result.created_self_tests += 1
                _, notification_created = _create_review_log(
                    employer=employer,
                    respondent=employer,
                    period=zero_period,
                    context=ReviewLog.CONTEXT_SKILL,
                    metadata={"review_type": "self", "trigger": "hire_day"},
                )
                if notification_created:
                    result.notifications_created += 1

        for period in periods:
            if period.month_period == 0:
                continue
            if not _is_period_due(period, current_date=current_date, employer=employer):
                continue

            for respondent in active_employees:
                if respondent.id == employer.id:
                    continue
                created_answers, _ = _create_question_placeholders(
                    employer=employer,
                    respondent=respondent,
                    period=period,
                    questions=questions,
                )
                if created_answers:
                    result.created_peer_reviews += 1
                    _, notification_created = _create_review_log(
                        employer=employer,
                        respondent=respondent,
                        period=period,
                        context=ReviewLog.CONTEXT_SKILL,
                        metadata={"review_type": "peer", "period": period.month_period},
                    )
                    if notification_created:
                        result.notifications_created += 1

    return result.as_dict()


def _validate_log_token(token: str) -> ReviewLog:
    try:
        review_log = ReviewLog.objects.select_related("employer", "respondent", "period").get(token=token)
    except ReviewLog.DoesNotExist as exc:
        raise ServiceError("Invalid or unknown token", code="invalid_token", status=404) from exc

    if review_log.status == ReviewLog.STATUS_COMPLETED:
        raise ServiceError("Review already submitted", code="already_submitted", status=409)

    if timezone.now() >= review_log.expires_at:
        review_log.status = ReviewLog.STATUS_EXPIRED
        review_log.save(update_fields=["status", "updated_at"])
        raise ServiceError("Link expired", code="link_expired", status=410)

    return review_log


def fetch_skill_form(token: str) -> Dict:
    review_log = _validate_log_token(token)
    employer = review_log.employer
    respondent = review_log.respondent
    period = review_log.period

    questions = list(
        SkillQuestion.objects.filter(is_active=True)
        .select_related("category")
        .order_by("category__skill_type", "category__name", "id")
    )

    existing_answers = {
        answer.question_id: answer.grade
        for answer in ReviewAnswer.objects.filter(
            employer=employer,
            respondent=respondent,
            period=period,
        )
    }

    hard_payload: List[Dict] = []
    soft_payload: List[Dict] = []

    questions_by_category: Dict[int, Dict] = {}

    for question in questions:
        question_entry = {
            "id": question.id,
            "question": question.question_text,
            "grade": existing_answers.get(question.id, 0),
        }
        container = hard_payload if question.category.skill_type == SkillCategory.HARD else soft_payload

        category_payload = questions_by_category.setdefault(
            question.category_id,
            {
                "category": question.category.name,
                "items": [],
            },
        )
        category_payload["items"].append(question_entry)

        if category_payload not in container:
            container.append(category_payload)

    response = {
        "status": "success",
        "review_type": "self" if employer.id == respondent.id else "peer",
        "review_period": period.name or f"{period.month_period} months",
        "employer": {
            "id": employer.id,
            "fio": employer.fio,
            "position": employer.position,
        },
        "respondent": {
            "id": respondent.id,
            "fio": respondent.fio,
        },
        "questions": {
            "hard_skills": hard_payload,
            "soft_skills": soft_payload,
        },
        "link_valid_until": review_log.expires_at.isoformat(),
    }
    return response


@transaction.atomic
def submit_skill_answers(token: str, answers: List[Dict], *, partial: bool = False) -> Dict:
    review_log = _validate_log_token(token)
    employer = review_log.employer
    respondent = review_log.respondent
    period = review_log.period

    if not isinstance(answers, list) or not answers:
        raise ServiceError("Answers payload is empty", code="empty_answers")

    updated = 0
    for row in answers:
        question_id = row.get("id_question") or row.get("question")
        grade = row.get("grade")
        if question_id is None:
            raise ServiceError("Question id is required", code="missing_question")
        try:
            question = SkillQuestion.objects.select_related("category").get(pk=question_id)
        except SkillQuestion.DoesNotExist as exc:
            raise ServiceError(f"Question {question_id} not found", code="unknown_question") from exc

        if not isinstance(grade, int) or grade not in range(0, 11):
            raise ServiceError("Grade must be an integer between 0 and 10", code="invalid_grade")

        answer, _ = ReviewAnswer.objects.get_or_create(
            employer=employer,
            respondent=respondent,
            period=period,
            question=question,
            defaults={
                "question_type": question.category.skill_type,
                "grade": 0,
            },
        )
        answer.grade = grade
        answer.question_type = question.category.skill_type
        answer.save(update_fields=["grade", "question_type", "updated_at"])
        updated += 1

    if not partial:
        review_log.status = ReviewLog.STATUS_COMPLETED
        review_log.metadata = {**(review_log.metadata or {}), "submitted_at": timezone.now().isoformat()}
    else:
        review_log.status = ReviewLog.STATUS_PENDING
        review_log.metadata = {**(review_log.metadata or {}), "save_mode": "partial"}
    review_log.save(update_fields=["status", "metadata", "updated_at"])

    if not partial:
        now = timezone.now()
        SiteNotification.objects.filter(related_log=review_log).update(
            is_read=True,
            read_at=now,
            updated_at=now,
        )

    return {
        "status": "success",
        "updated_count": updated,
        "message": "Answers successfully submitted" if not partial else "Draft saved",
    }


def _build_category_key(question: SkillQuestion) -> Tuple[str, str]:
    return question.category.skill_type, question.category.name


def _period_label(period: ReviewPeriod) -> str:
    if period.month_period == 0:
        return period.name or "start"
    return period.name or f"{period.month_period}m"


def review_analytics(
    *,
    employer: Employer,
    period: Optional[ReviewPeriod] = None,
    skill_type: str = "all",
) -> Dict:
    filters = {"employer": employer}
    if period:
        filters["period"] = period
    if skill_type in {SkillCategory.HARD, SkillCategory.SOFT}:
        filters["question_type"] = skill_type

    answers = (
        ReviewAnswer.objects.filter(**filters)
        .select_related("question", "question__category", "respondent", "period")
        .order_by("period__month_period", "question__category__name")
    )

    if not answers.exists():
        return {
            "status": "success",
            "employer_id": employer.id,
            "fio": employer.fio,
            "position": employer.position,
            "analytics": [],
            "averages": {
                "overall_self": 0,
                "overall_peer": 0,
                "delta": 0,
            },
        }

    analytics: Dict[Tuple[str, str], Dict] = {}
    overall_self_grades: List[int] = []
    overall_peer_grades: List[int] = []

    answers_by_period_category: Dict[Tuple[str, str, int], Dict[str, List[int]]] = defaultdict(lambda: {"self": [], "peer": []})

    for answer in answers:
        if answer.grade == 0:
            continue
        key = (answer.question.category.skill_type, answer.question.category.name, answer.period_id)
        bucket = answers_by_period_category[key]
        if answer.is_self_review:
            bucket["self"].append(answer.grade)
            overall_self_grades.append(answer.grade)
        else:
            bucket["peer"].append(answer.grade)
            overall_peer_grades.append(answer.grade)

    periods_map: Dict[int, ReviewPeriod] = {
        a.period_id: a.period for a in answers
    }

    structured: Dict[Tuple[str, str], Dict] = defaultdict(lambda: {"periods": []})

    for (skill_type_key, category_name, period_id), values in sorted(
        answers_by_period_category.items(),
        key=lambda item: (periods_map[item[0][2]].month_period, item[0][0], item[0][1]),
    ):
        period_obj = periods_map[period_id]
        period_entry = {
            "period": _period_label(period_obj),
            "period_order": period_obj.month_period,
            "period_id": period_obj.id,
            "self": round(sum(values["self"]) / len(values["self"]), 2) if values["self"] else None,
            "peer": round(sum(values["peer"]) / len(values["peer"]), 2) if values["peer"] else None,
            "trend_self": None,
            "trend_peer": None,
        }

        category_key = (skill_type_key, category_name)
        category_payload = structured[category_key]
        category_payload.setdefault("skill_type", skill_type_key)
        category_payload.setdefault("category", category_name)
        category_payload["periods"].append(period_entry)

    for payload in structured.values():
        periods_data = payload["periods"]
        periods_data.sort(key=lambda item: item["period_order"])
        prev_self = prev_peer = None
        for entry in periods_data:
            self_grade = entry["self"]
            peer_grade = entry["peer"]
            if prev_self is not None and self_grade is not None:
                entry["trend_self"] = round(self_grade - prev_self, 2)
            if prev_peer is not None and peer_grade is not None:
                entry["trend_peer"] = round(peer_grade - prev_peer, 2)
            prev_self = self_grade if self_grade is not None else prev_self
            prev_peer = peer_grade if peer_grade is not None else prev_peer
            entry.pop("period_order", None)

    overall_self = round(sum(overall_self_grades) / len(overall_self_grades), 2) if overall_self_grades else 0
    overall_peer = round(sum(overall_peer_grades) / len(overall_peer_grades), 2) if overall_peer_grades else 0

    return {
        "status": "success",
        "employer_id": employer.id,
        "fio": employer.fio,
        "position": employer.position,
        "analytics": list(structured.values()),
        "averages": {
            "overall_self": overall_self,
            "overall_peer": overall_peer,
            "delta": round(overall_peer - overall_self, 2),
        },
    }


def adaptation_index(
    *,
    employer: Employer,
    period: Optional[ReviewPeriod] = None,
    skill_type: str = "all",
) -> Dict:
    analytics = review_analytics(employer=employer, period=period, skill_type=skill_type)
    averages = analytics["averages"]
    overall_self = averages["overall_self"]
    overall_peer = averages["overall_peer"]
    delta = averages["delta"]

    base_score = ((overall_self + overall_peer) / 2) * 10

    if delta < -1:
        adjust_delta = -abs(delta) * 2.5
    elif delta > 1:
        adjust_delta = abs(delta) * 1.5
    else:
        adjust_delta = 0

    trends_self: List[float] = []
    trends_peer: List[float] = []

    unanswered_ratio = 0
    total_records = ReviewAnswer.objects.filter(employer=employer).count()
    unanswered = ReviewAnswer.objects.filter(employer=employer, grade=0).count()
    if total_records:
        unanswered_ratio = unanswered / total_records

    for category in analytics["analytics"]:
        for period_entry in category["periods"]:
            trend_self = period_entry.get("trend_self")
            trend_peer = period_entry.get("trend_peer")
            if trend_self is not None:
                trends_self.append(trend_self)
            if trend_peer is not None:
                trends_peer.append(trend_peer)

    adjust_trend = (sum(trends_self) + sum(trends_peer)) * 3 if (trends_self or trends_peer) else 0
    adjust_missing = -10 if unanswered_ratio > 0.2 else 0

    adaptation_index_value = base_score + adjust_delta + adjust_trend + adjust_missing
    adaptation_index_value = max(0, min(100, adaptation_index_value))

    if adaptation_index_value < 50:
        color_zone = "red"
    elif adaptation_index_value < 70:
        color_zone = "yellow"
    elif adaptation_index_value < 86:
        color_zone = "green"
    else:
        color_zone = "blue"

    return {
        "status": "success",
        "employer_id": employer.id,
        "fio": employer.fio,
        "position": employer.position,
        "period": _period_label(period) if period else "latest",
        "AdaptationIndex": round(adaptation_index_value, 1),
        "components": {
            "base_score": round(base_score, 1),
            "adjust_delta": round(adjust_delta, 1),
            "adjust_trend": round(adjust_trend, 1),
            "adjust_missing": adjust_missing,
        },
        "color_zone": color_zone,
        "interpretation": _interpret_zone(color_zone),
    }


def _interpret_zone(color_zone: str) -> str:
    return {
        "red": "Signs of low adaptation or engagement.",
        "yellow": "Attention needed: instability or conflicting feedback.",
        "green": "Healthy adaptation trajectory.",
        "blue": "High engagement and leadership potential.",
    }[color_zone]


# The following helpers implement the extended Task & Goal review workflow.


def create_goal_with_tasks(
    *,
    title: str,
    description: str,
    employer: Employer,
    creator: Employer,
    deadline: Optional[date],
    tasks_payload: List[Dict],
) -> Dict:
    with transaction.atomic():
        goal = ReviewGoal.objects.create(
            title=title,
            description=description,
            employer=employer,
            creator=creator,
            deadline=deadline,
        )

        created_tasks = []
        for task_data in tasks_payload:
            task = ReviewTask.objects.create(
                goal=goal,
                title=task_data["title"],
                description=task_data.get("description", ""),
                start_date=task_data["start_date"],
                end_date=task_data["end_date"],
            )
            ReviewSchedule.objects.create(
                context=ReviewLog.CONTEXT_TASK,
                related_task=task,
                review_start=task.end_date,
                review_end=task.end_date + timedelta(days=7),
            )
            created_tasks.append(task)

    return {
        "goal": goal,
        "tasks": created_tasks,
    }


@transaction.atomic
def trigger_task_reviews(current_date: date, task: Optional[ReviewTask] = None) -> List[Dict]:
    if task:
        tasks = [task]
    else:
        tasks = list(
            ReviewTask.objects.filter(
                end_date__lte=current_date,
                status="active",
            ).select_related("goal", "goal__employer")
        )

    if not tasks:
        return []

    results = []
    questions = list(
        ReviewQuestion.objects.filter(context=ReviewLog.CONTEXT_TASK, is_active=True).order_by("category")
    )

    if not questions:
        return []

    active_employers = list(_active_employers(current_date))

    for task_obj in tasks:
        employer = task_obj.goal.employer
        respondents = _task_respondents(employer, active_employers)
        respondents.add(employer)

        notifications_for_task = 0

        for respondent in respondents:
            for question in questions:
                TaskReviewAnswer.objects.get_or_create(
                    task=task_obj,
                    employer=employer,
                    respondent=respondent,
                    question=question,
                    defaults={"grade": 0},
                )
            _, created_notification = _create_review_log(
                employer=employer,
                respondent=respondent,
                period=None,
                context=ReviewLog.CONTEXT_TASK,
                metadata={"task_id": str(task_obj.id), "task_title": task_obj.title},
            )
            if created_notification:
                notifications_for_task += 1

        task_obj.status = "review"
        task_obj.save(update_fields=["status", "updated_at"])
        ReviewSchedule.objects.filter(related_task=task_obj).update(status="in_progress")
        results.append({
            "task_id": str(task_obj.id),
            "respondents": [r.id for r in respondents],
            "notifications_created": notifications_for_task,
        })

    return results


def _task_respondents(employer: Employer, population: Iterable[Employer]) -> set:
    explicit_relations = set(
        TeamRelation.objects.filter(employer=employer).values_list("peer_id", flat=True)
    )
    if explicit_relations:
        respondents_qs = Employer.objects.filter(id__in=explicit_relations)
    else:
        respondents_qs = Employer.objects.filter(id__in=[item.id for item in population if item.id != employer.id])
    return set(respondents_qs)


def fetch_task_form(token: str) -> Dict:
    review_log = _validate_log_token(token)
    if review_log.context != ReviewLog.CONTEXT_TASK:
        raise ServiceError("Token does not belong to a task review", code="invalid_context")

    task_id = review_log.metadata.get("task_id")
    try:
        task = ReviewTask.objects.select_related("goal", "goal__employer").get(id=task_id)
    except ReviewTask.DoesNotExist as exc:
        raise ServiceError("Task not found", code="task_not_found", status=404) from exc

    answers = {
        answer.question_id: answer.grade
        for answer in TaskReviewAnswer.objects.filter(
            task=task,
            employer=review_log.employer,
            respondent=review_log.respondent,
        )
    }

    questions = list(
        ReviewQuestion.objects.filter(context=ReviewLog.CONTEXT_TASK, is_active=True).order_by("category")
    )

    categories: Dict[str, Dict] = {}
    for question in questions:
        category_payload = categories.setdefault(
            question.category,
            {"category": question.category, "items": []},
        )
        category_payload["items"].append(
            {
                "id": str(question.id),
                "text": question.question_text,
                "grade": answers.get(question.id, 0),
            }
        )

    return {
        "status": "success",
        "task": {
            "id": str(task.id),
            "title": task.title,
            "description": task.description,
            "start_date": task.start_date.isoformat(),
            "end_date": task.end_date.isoformat(),
        },
        "review": {
            "type": "self" if review_log.employer_id == review_log.respondent_id else "peer",
            "respondent_id": review_log.respondent_id,
            "employer_id": review_log.employer_id,
        },
        "questions": list(categories.values()),
        "link_valid_until": review_log.expires_at.isoformat(),
    }


@transaction.atomic
def submit_task_answers(token: str, answers: List[Dict]) -> Dict:
    review_log = _validate_log_token(token)
    if review_log.context != ReviewLog.CONTEXT_TASK:
        raise ServiceError("Token does not belong to a task review", code="invalid_context")

    task_id = review_log.metadata.get("task_id")
    try:
        task = ReviewTask.objects.get(id=task_id)
    except ReviewTask.DoesNotExist as exc:
        raise ServiceError("Task not found", code="task_not_found", status=404) from exc

    if not isinstance(answers, list) or not answers:
        raise ServiceError("Answers payload is empty", code="empty_answers")

    updated = 0
    for row in answers:
        question_id = row.get("id_question") or row.get("id")
        grade = row.get("grade")
        if question_id is None:
            raise ServiceError("Question id is required", code="missing_question")
        try:
            question = ReviewQuestion.objects.get(id=question_id, context=ReviewLog.CONTEXT_TASK)
        except ReviewQuestion.DoesNotExist as exc:
            raise ServiceError("Question not found", code="unknown_question") from exc

        if not isinstance(grade, int) or grade not in range(0, 11):
            raise ServiceError("Grade must be an integer between 0 and 10", code="invalid_grade")

        answer, _ = TaskReviewAnswer.objects.get_or_create(
            task=task,
            employer=review_log.employer,
            respondent=review_log.respondent,
            question=question,
            defaults={"grade": 0},
        )
        answer.grade = grade
        answer.save(update_fields=["grade", "updated_at"])
        updated += 1

    review_log.status = ReviewLog.STATUS_COMPLETED
    review_log.metadata = {**(review_log.metadata or {}), "submitted_at": timezone.now().isoformat()}
    review_log.save(update_fields=["status", "metadata", "updated_at"])

    now = timezone.now()
    SiteNotification.objects.filter(related_log=review_log).update(
        is_read=True,
        read_at=now,
        updated_at=now,
    )

    remaining = TaskReviewAnswer.objects.filter(task=task, grade=0).exists()
    if not remaining:
        task.status = "completed"
        task.save(update_fields=["status", "updated_at"])
        ReviewSchedule.objects.filter(related_task=task).update(status="completed")

    return {
        "status": "success",
        "task_id": str(task.id),
        "respondent_id": review_log.respondent_id,
        "answers_saved": updated,
        "review_completed": not remaining,
    }


def sync_employer_from_employee(employee: "Employee") -> Optional[Employer]:
    """Synchronise performance Employer profile with core Employee record."""

    if employee is None:
        return None

    user = employee.user
    if user is None:
        return None

    email = (user.email or "").strip().lower()
    if not email:
        return None

    fio_parts = [
        part for part in [user.last_name, user.first_name, getattr(user, "patronymic", "")] if part
    ]
    fio = " ".join(fio_parts) or user.get_full_name() or user.username or email

    defaults = {
        "fio": fio,
        "position": employee.position or "Сотрудник",
        "date_of_employment": employee.hire_date,
    }

    employer, created = Employer.objects.get_or_create(email=email, defaults=defaults)

    update_fields: List[str] = []

    if employer.user_id != user.id:
        employer.user = user
        update_fields.append("user")

    if employer.fio != fio:
        employer.fio = fio
        update_fields.append("fio")

    if employee.hire_date and employer.date_of_employment != employee.hire_date:
        employer.date_of_employment = employee.hire_date
        update_fields.append("date_of_employment")

    if employee.position and employer.position != employee.position:
        employer.position = employee.position
        update_fields.append("position")

    if update_fields:
        update_fields.append("updated_at")
        employer.save(update_fields=update_fields)
    elif created:
        employer.save()

    return employer
