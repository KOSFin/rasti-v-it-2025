from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple

from django.db.models import Avg, Count, Max, Q
from django.utils import timezone

from ..models import (
    Employee,
    Feedback360,
    FinalReview,
    Goal,
    ManagerReview,
    NineBoxSnapshot,
    PotentialAssessment,
    SelfAssessment,
    Task,
)


@dataclass
class EmployeeNineBoxMetrics:
    employee: Employee
    performance_score: float
    potential_score: float
    goal_completion_rate: float
    task_completion_rate: float
    feedback_score: float
    manager_score: float
    self_assessment_score: float
    final_review_score: float
    potential_signal: float
    retention_risk: float
    source_meta: Dict[str, Any]

    def as_matrix_item(self) -> Dict[str, Any]:
        data = {
            'employee_id': self.employee.id,
            'employee_name': self.employee.user.get_full_name() if self.employee.user_id else '',
            'department': self.employee.department.name if self.employee.department else '',
            'department_id': self.employee.department_id,
            'position': self.employee.position_title or '',
            'performance_score': round(self.performance_score, 2),
            'potential_score': round(self.potential_score, 2),
            'scores': {
                'goal_completion_rate': round(self.goal_completion_rate, 2),
                'task_completion_rate': round(self.task_completion_rate, 2),
                'feedback_average': round(self.feedback_score, 2),
                'manager_average': round(self.manager_score, 2),
                'self_assessment_average': round(self.self_assessment_score, 2),
                'final_review_score': round(self.final_review_score, 2),
                'potential_signal': round(self.potential_signal, 2),
                'retention_risk': round(self.retention_risk, 2),
            },
            'meta': _serialize_meta(self.source_meta),
        }
        data['nine_box_x'] = map_axis_position(data['performance_score'])
        data['nine_box_y'] = map_axis_position(data['potential_score'])
        data['ai_recommendations'] = build_ai_recommendations(data)
        return data


AXIS_HIGH_THRESHOLD = 70
AXIS_MID_THRESHOLD = 40


def map_axis_position(score: float) -> int:
    if score >= AXIS_HIGH_THRESHOLD:
        return 2
    if score >= AXIS_MID_THRESHOLD:
        return 1
    return 0


def _normalize_score(raw_score: Optional[float], *, base: float = 10.0) -> float:
    if raw_score is None:
        return 0.0
    if raw_score <= base:
        return max(0.0, min(raw_score, base)) / base * 100
    return max(0.0, min(raw_score, 100.0))


def _normalize_ratio(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return max(0.0, min(numerator / denominator * 100.0, 100.0))


def _normalize_retention(risk_value: Optional[float]) -> float:
    if risk_value is None:
        return 50.0
    return max(0.0, min(float(risk_value or 0) / 10.0 * 100.0, 100.0))


def _latest_timestamp(*timestamps: Optional[Any]) -> Optional[Any]:
    values = [value for value in timestamps if value]
    if not values:
        return None
    return max(values)


def build_ai_recommendations(entry: Dict[str, Any]) -> List[ Dict[str, Any] ]:
    recommendations: List[Dict[str, Any]] = []
    performance = entry['performance_score']
    potential = entry['potential_score']
    scores = entry['scores']
    retention_risk = scores.get('retention_risk', 50)
    goal_rate = scores.get('goal_completion_rate', 0)
    task_rate = scores.get('task_completion_rate', 0)
    manager_score = scores.get('manager_average', 0)

    if potential >= 70 and performance < 45:
        recommendations.append({
            'priority': 'high',
            'title': 'Развить скрытый потенциал',
            'description': 'Назначьте сотруднику бадди или наставника для ускорения выхода на новый уровень результативности.',
            'actions': [
                'Назначить бадди с опытом в ключевых задачах',
                'Запланировать еженедельные встречи обратной связи',
            ],
        })

    if retention_risk >= 60:
        recommendations.append({
            'priority': 'high',
            'title': 'Удержание ключевого специалиста',
            'description': 'Проведите индивидуальную встречу для обсуждения мотивации и факторов риска ухода.',
            'actions': [
                'Запланировать разговор с HR и руководителем',
                'Проработать персональный план развития и компенсации',
            ],
        })

    if performance >= 80 and potential >= 80:
        recommendations.append({
            'priority': 'medium',
            'title': 'Подготовка к продвижению',
            'description': 'Сотрудник стабильно превышает ожидания. Подготовьте план ускоренного развития и удержания.',
            'actions': [
                'Подобрать программу лидерского развития',
                'Оценить возможность карьерного продвижения в ближайшие 6-12 месяцев',
            ],
        })

    if goal_rate < 50 or task_rate < 50:
        recommendations.append({
            'priority': 'medium',
            'title': 'Фокус на достижении целей',
            'description': 'Снизить количество параллельных задач, усилить контроль промежуточных результатов и внедрить чекпоинты.',
            'actions': [
                'Сформировать 3-недельный план исправления',
                'Назначить ответственного наставника из команды',
            ],
        })

    if manager_score < 45 and performance < 45:
        recommendations.append({
            'priority': 'high',
            'title': 'План повышения эффективности',
            'description': 'Сформируйте совместный с командой план корректирующих действий и определите метрики контроля.',
            'actions': [
                'Назначить еженедельные one-on-one встречи',
                'Пересмотреть KPI и постановку задач на квартал',
            ],
        })

    if not recommendations:
        recommendations.append({
            'priority': 'low',
            'title': 'Поддерживать текущую динамику',
            'description': 'Сотрудник демонстрирует стабильность. Обеспечьте регулярную обратную связь и актуальные вызовы.',
            'actions': ['Раз в квартал сверять цели развития', 'Отслеживать вовлеченность и мотивацию'],
        })

    return recommendations


def _serialize_meta(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _serialize_meta(val) for key, val in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serialize_meta(item) for item in value]
    return value


def _compute_performance_score(*, manager_avg: float, feedback_avg: float, goal_rate: float, task_rate: float, final_review_score: float) -> float:
    weights = {
        'manager': 0.35,
        'feedback': 0.2,
        'goals': 0.2,
        'tasks': 0.1,
        'final': 0.15,
    }
    return (
        manager_avg * weights['manager'] +
        feedback_avg * weights['feedback'] +
        goal_rate * weights['goals'] +
        task_rate * weights['tasks'] +
        final_review_score * weights['final']
    )


def _compute_potential_score(*, self_avg: float, feedback_avg: float, potential_signal: float, retention_inverse: float) -> float:
    weights = {
        'self': 0.3,
        'feedback': 0.2,
        'potential': 0.3,
        'retention': 0.2,
    }
    return (
        self_avg * weights['self'] +
        feedback_avg * weights['feedback'] +
        potential_signal * weights['potential'] +
        retention_inverse * weights['retention']
    )


def collect_employee_metrics(employees: Iterable[Employee]) -> List[EmployeeNineBoxMetrics]:
    employees = list(employees)
    if not employees:
        return []

    employee_ids = [emp.id for emp in employees]

    feedback_data = {
        row['employee']: row
        for row in Feedback360.objects.filter(employee_id__in=employee_ids).values('employee').annotate(
            avg_score=Avg('calculated_score'),
            last_score=Max('created_at'),
            responses=Count('id'),
        )
    }

    self_data = {
        row['employee']: row
        for row in SelfAssessment.objects.filter(employee_id__in=employee_ids).values('employee').annotate(
            avg_score=Avg('calculated_score'),
            last_score=Max('created_at'),
        )
    }

    manager_data = {
        row['employee']: row
        for row in ManagerReview.objects.filter(employee_id__in=employee_ids).values('employee').annotate(
            avg_score=Avg('calculated_score'),
            last_score=Max('created_at'),
        )
    }

    final_review_data = {
        row['employee']: row
        for row in FinalReview.objects.filter(employee_id__in=employee_ids).values('employee').annotate(
            last_total=Max('total_score'),
            last_date=Max('created_at'),
        )
    }

    potential_assessments = (
        PotentialAssessment.objects.filter(employee_id__in=employee_ids)
        .order_by('employee_id', '-created_at')
    )
    potential_map: Dict[int, PotentialAssessment] = {}
    for assessment in potential_assessments:
        if assessment.employee_id not in potential_map:
            potential_map[assessment.employee_id] = assessment

    goals = Goal.objects.filter(goal_participants__employee_id__in=employee_ids).values('goal_participants__employee_id').annotate(
        total=Count('id', distinct=True),
        completed=Count('id', filter=Q(is_completed=True), distinct=True),
    )
    goal_map = {row['goal_participants__employee_id']: row for row in goals}

    tasks = Task.objects.filter(goal__goal_participants__employee_id__in=employee_ids).values('goal__goal_participants__employee_id').annotate(
        total=Count('id', distinct=True),
        completed=Count('id', filter=Q(is_completed=True), distinct=True),
    )
    task_map = {row['goal__goal_participants__employee_id']: row for row in tasks}

    metrics: List[EmployeeNineBoxMetrics] = []
    for employee in employees:
        feedback_row = feedback_data.get(employee.id, {})
        self_row = self_data.get(employee.id, {})
        manager_row = manager_data.get(employee.id, {})
        final_row = final_review_data.get(employee.id, {})
        goal_row = goal_map.get(employee.id, {})
        task_row = task_map.get(employee.id, {})
        potential = potential_map.get(employee.id)

        feedback_avg = _normalize_score(feedback_row.get('avg_score'))
        self_avg = _normalize_score(self_row.get('avg_score'))
        manager_avg = _normalize_score(manager_row.get('avg_score'))
        final_score = _normalize_score(final_row.get('last_total'), base=100.0)

        goal_rate = _normalize_ratio(goal_row.get('completed', 0), goal_row.get('total', 0))
        task_rate = _normalize_ratio(task_row.get('completed', 0), task_row.get('total', 0))

        potential_signal = 0.0
        retention_risk = None
        potential_meta: Dict[str, Any] = {}
        if potential:
            potential_signal = min(float(potential.potential_score or 0) * 10.0, 100.0)
            retention_risk = potential.retention_risk
            potential_meta = {
                'assessment_id': potential.id,
                'development_desire': potential.development_desire,
                'is_successor': potential.is_successor,
                'successor_readiness': potential.successor_readiness,
                'created_at': potential.created_at,
            }
            if potential.is_successor:
                potential_signal = min(100.0, potential_signal + 10)

        retention_pct = _normalize_retention(retention_risk)
        retention_inverse = 100.0 - retention_pct

        performance_score = _compute_performance_score(
            manager_avg=manager_avg,
            feedback_avg=feedback_avg,
            goal_rate=goal_rate,
            task_rate=task_rate,
            final_review_score=final_score,
        )
        potential_score = _compute_potential_score(
            self_avg=self_avg,
            feedback_avg=feedback_avg,
            potential_signal=potential_signal,
            retention_inverse=retention_inverse,
        )

        meta = {
            'feedback_last_at': feedback_row.get('last_score'),
            'self_last_at': self_row.get('last_score'),
            'manager_last_at': manager_row.get('last_score'),
            'final_last_at': final_row.get('last_date'),
            'potential': potential_meta,
            'last_updated_at': _latest_timestamp(
                feedback_row.get('last_score'),
                self_row.get('last_score'),
                manager_row.get('last_score'),
                final_row.get('last_date'),
                potential_meta.get('created_at'),
            ),
        }

        metrics.append(
            EmployeeNineBoxMetrics(
                employee=employee,
                performance_score=performance_score,
                potential_score=potential_score,
                goal_completion_rate=goal_rate,
                task_completion_rate=task_rate,
                feedback_score=feedback_avg,
                manager_score=manager_avg,
                self_assessment_score=self_avg,
                final_review_score=final_score,
                potential_signal=potential_signal,
                retention_risk=retention_pct,
                source_meta=meta,
            )
        )

    return metrics


def build_matrix_payload(employees: Iterable[Employee]) -> Dict[str, Any]:
    metrics = collect_employee_metrics(employees)
    matrix = [item.as_matrix_item() for item in metrics]
    distribution: Dict[str, int] = {
        'low-low': 0,
        'mid-low': 0,
        'high-low': 0,
        'low-mid': 0,
        'mid-mid': 0,
        'high-mid': 0,
        'low-high': 0,
        'mid-high': 0,
        'high-high': 0,
    }

    total_perf = 0.0
    total_potential = 0.0

    for entry in matrix:
        total_perf += entry['performance_score']
        total_potential += entry['potential_score']
        x = entry['nine_box_x']
        y = entry['nine_box_y']
        code_map = {
            (0, 0): 'low-low',
            (1, 0): 'mid-low',
            (2, 0): 'high-low',
            (0, 1): 'low-mid',
            (1, 1): 'mid-mid',
            (2, 1): 'high-mid',
            (0, 2): 'low-high',
            (1, 2): 'mid-high',
            (2, 2): 'high-high',
        }
        code = code_map.get((x, y))
        if code:
            distribution[code] += 1

    total = len(matrix)
    stats = {
        'total_employees': total,
        'average_performance': round(total_perf / total, 2) if total else 0.0,
        'average_potential': round(total_potential / total, 2) if total else 0.0,
        'distribution': distribution,
    }

    recommendations: List[Dict[str, Any]] = []
    for entry in matrix:
        for rec in entry.get('ai_recommendations', []):
            recommendations.append({
                **rec,
                'employee_id': entry['employee_id'],
                'employee_name': entry['employee_name'],
                'department': entry.get('department'),
                'priority': rec.get('priority', 'medium'),
                'performance_score': entry['performance_score'],
                'potential_score': entry['potential_score'],
            })

    priority_order = {'high': 0, 'medium': 1, 'low': 2}
    recommendations.sort(
        key=lambda item: (
            priority_order.get(item['priority'], 1),
            -item.get('potential_score', 0),
            -item.get('performance_score', 0),
        )
    )

    return {
        'matrix': matrix,
        'stats': stats,
        'ai_recommendations': recommendations[:25],
    }


def get_active_snapshot(*, scope: str, freshness_minutes: int) -> Optional[NineBoxSnapshot]:
    now = timezone.now()
    snapshot = (
        NineBoxSnapshot.objects.filter(
            scope=scope,
            valid_until__gte=now,
            generated_at__gte=now - timedelta(minutes=freshness_minutes),
        )
        .order_by('-generated_at')
        .first()
    )
    if snapshot and snapshot.valid_until >= now:
        return snapshot
    return None


def generate_snapshot(
    *,
    employees: Iterable[Employee],
    scope: str,
    ttl_minutes: int,
    source: NineBoxSnapshot.Source = NineBoxSnapshot.Source.ON_DEMAND,
    generated_by: Optional[Employee] = None,
) -> Tuple[NineBoxSnapshot, Dict[str, Any]]:
    dataset = build_matrix_payload(employees)
    now = timezone.now()
    snapshot = NineBoxSnapshot.objects.create(
        scope=scope,
        source=source,
        generated_by=generated_by,
        valid_until=now + timedelta(minutes=ttl_minutes),
        payload={'matrix': dataset['matrix']},
        stats=dataset['stats'],
        ai_recommendations=dataset['ai_recommendations'],
    )
    dataset['generated_at'] = snapshot.generated_at
    dataset['valid_until'] = snapshot.valid_until
    dataset['source'] = source.value if hasattr(source, 'value') else str(source)
    return snapshot, dataset
