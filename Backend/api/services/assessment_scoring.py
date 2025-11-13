from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, Iterable, List, Optional

from ..models import AssessmentQuestionTemplate


@dataclass
class QuestionEvaluation:
    question_id: str
    title: str
    category: str
    answer_type: str
    answer: Any
    score: float
    max_score: float
    weight: int
    is_correct: bool

    def as_json(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload['score'] = round(self.score, 2)
        payload['max_score'] = round(self.max_score, 2)
        return payload


@dataclass
class EvaluationResult:
    answers: List[QuestionEvaluation]
    total_score: float
    total_max_score: float
    accuracy: float
    categories: List[Dict[str, Any]]

    def as_breakdown(self) -> Dict[str, Any]:
        return {
            'score': round(self.total_score, 2),
            'max_score': round(self.total_max_score, 2),
            'accuracy': round(self.accuracy, 2),
            'categories': self.categories,
        }

    def answers_json(self) -> List[Dict[str, Any]]:
        return [answer.as_json() for answer in self.answers]


def get_effective_question_bank(context: str, department_id: Optional[int]) -> List[AssessmentQuestionTemplate]:
    base_queryset = AssessmentQuestionTemplate.objects.filter(context=context, is_active=True).order_by('order', 'created_at')
    global_questions = list(base_queryset.filter(department__isnull=True))
    if not department_id:
        return global_questions

    department_questions = list(base_queryset.filter(department_id=department_id))
    result: Dict[int, AssessmentQuestionTemplate] = {question.order: question for question in global_questions}
    for question in department_questions:
        result[question.order] = question
    return [result[key] for key in sorted(result.keys())]


def _parse_boolean(answer: Any) -> Optional[bool]:
    if isinstance(answer, bool):
        return answer
    if isinstance(answer, (int, float)):
        return bool(answer)
    if isinstance(answer, str):
        value = answer.strip().lower()
        if value in {'1', 'true', 'yes', 'да'}:
            return True
        if value in {'0', 'false', 'no', 'нет'}:
            return False
    return None


def _parse_number(answer: Any) -> Optional[float]:
    if isinstance(answer, (int, float)):
        return float(answer)
    if isinstance(answer, str):
        try:
            return float(answer.replace(',', '.'))
        except ValueError:
            return None
    return None


def _build_category_breakdown(evaluations: Iterable[QuestionEvaluation]) -> List[Dict[str, Any]]:
    aggregates: Dict[str, Dict[str, float]] = {}
    for evaluation in evaluations:
        category = evaluation.category or 'Общее'
        bucket = aggregates.setdefault(category, {'score': 0.0, 'max_score': 0.0, 'questions': 0})
        bucket['score'] += evaluation.score
        bucket['max_score'] += evaluation.max_score
        bucket['questions'] += 1

    breakdown: List[Dict[str, Any]] = []
    for category, stats in aggregates.items():
        max_score = stats['max_score']
        accuracy = (stats['score'] / max_score * 100) if max_score else 0.0
        breakdown.append({
            'category': category,
            'score': round(stats['score'], 2),
            'max_score': round(max_score, 2),
            'accuracy': round(accuracy, 2),
            'questions': stats['questions'],
        })

    breakdown.sort(key=lambda item: item['accuracy'])
    return breakdown


def evaluate_answers(
    *,
    context: str,
    answers: Iterable[Dict[str, Any]],
    department_id: Optional[int],
) -> EvaluationResult:
    answer_map = {str(item.get('question_id') or item.get('id')): item for item in answers if item}
    question_bank = get_effective_question_bank(context, department_id)

    evaluations: List[QuestionEvaluation] = []
    total_score = 0.0
    total_max = 0.0

    for question in question_bank:
        question_id = str(question.id)
        raw_answer_payload = answer_map.get(question_id, {})
        raw_answer = raw_answer_payload.get('answer') if isinstance(raw_answer_payload, dict) else raw_answer_payload
        score = 0.0
        max_score = float(question.max_score or 0) * question.weight
        is_correct = False

        if question.answer_type == 'scale':
            numeric_answer = _parse_number(raw_answer)
            if numeric_answer is not None:
                clamped = max(0.0, min(float(question.max_score), numeric_answer))
                score = clamped * question.weight
                is_correct = clamped >= question.max_score * 0.7
            answer_value = numeric_answer
        elif question.answer_type == 'numeric':
            numeric_answer = _parse_number(raw_answer)
            answer_value = numeric_answer
            expected = _parse_number(question.correct_answer)
            tolerance = float(question.tolerance or 0)
            if numeric_answer is not None and expected is not None:
                delta = abs(numeric_answer - expected)
                if delta <= tolerance:
                    score = max_score
                    is_correct = True
        elif question.answer_type == 'single_choice':
            answer_value = raw_answer
            expected_value = question.correct_answer
            if answer_value is not None and expected_value is not None:
                if isinstance(expected_value, (list, tuple, set)):
                    is_correct = answer_value in expected_value
                else:
                    is_correct = answer_value == expected_value
                score = max_score if is_correct else 0.0
        elif question.answer_type == 'boolean':
            bool_answer = _parse_boolean(raw_answer)
            answer_value = bool_answer
            expected_bool = _parse_boolean(question.correct_answer)
            if bool_answer is not None and expected_bool is not None:
                is_correct = bool_answer is expected_bool
                score = max_score if is_correct else 0.0
        else:
            answer_value = raw_answer

        total_score += score
        total_max += max_score
        evaluations.append(
            QuestionEvaluation(
                question_id=question_id,
                title=question.title,
                category=question.category or '',
                answer_type=question.answer_type,
                answer=answer_value,
                score=score,
                max_score=max_score,
                weight=question.weight,
                is_correct=is_correct,
            )
        )

    accuracy = (total_score / total_max * 100) if total_max else 0.0
    categories = _build_category_breakdown(evaluations)

    return EvaluationResult(
        answers=evaluations,
        total_score=total_score,
        total_max_score=total_max,
        accuracy=accuracy,
        categories=categories,
    )
*** End File