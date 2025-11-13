import { useEffect, useMemo, useState } from 'react';
import { getAssessmentQuestionBank } from '../api/services';
import './SelfAssessmentModal.css';

const DEFAULT_FORM = {
	achieved_results: '',
	personal_contribution: '',
	skills_acquired: '',
	improvements_needed: '',
	collaboration_quality: 5,
	satisfaction_score: 5,
};

const gradeOptions = Array.from({ length: 11 }, (_, index) => index);

const SelfAssessmentModal = ({ goal, saving = false, error = '', onSubmit, onClose }) => {
	const [form, setForm] = useState(DEFAULT_FORM);
  const [objectiveQuestions, setObjectiveQuestions] = useState([]);
  const [objectiveAnswers, setObjectiveAnswers] = useState({});
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState('');

	useEffect(() => {
		setForm(DEFAULT_FORM);
		setObjectiveAnswers({});
		setObjectiveQuestions([]);
		setQuestionsError('');
	}, [goal?.id]);

	useEffect(() => {
		let cancelled = false;
		const loadQuestions = async () => {
			if (!goal?.id) {
				setObjectiveQuestions([]);
				setObjectiveAnswers({});
				return;
			}
			setQuestionsLoading(true);
			setQuestionsError('');
			try {
				const params = { context: 'self' };
				if (goal?.department_id) {
					params.department = goal.department_id;
				}
				const response = await getAssessmentQuestionBank(params);
				const list = Array.isArray(response?.data)
					? response.data
					: Array.isArray(response?.data?.results)
					? response.data.results
					: [];
				if (!cancelled) {
					setObjectiveQuestions(list);
					const defaults = {};
					list.forEach((question) => {
						if (question.answer_type === 'scale') {
							const max = Number(question.max_score || 10);
							defaults[question.id] = Math.round(max / 2);
						} else if (question.answer_type === 'numeric') {
							defaults[question.id] = '';
						} else if (question.answer_type === 'boolean') {
							defaults[question.id] = false;
						} else {
							defaults[question.id] = '';
						}
					});
					setObjectiveAnswers(defaults);
				}
			} catch (err) {
				console.error('Не удалось загрузить вопросы для самооценки', err);
				if (!cancelled) {
					setObjectiveQuestions([]);
					setObjectiveAnswers({});
					setQuestionsError('Не удалось загрузить объективные вопросы. Попробуйте позже.');
				}
			} finally {
				if (!cancelled) {
					setQuestionsLoading(false);
				}
			}
		};
		loadQuestions();
		return () => {
			cancelled = true;
		};
	}, [goal?.id, goal?.department_id]);

	const completedTasks = useMemo(() => {
		if (!goal?.tasks) {
			return [];
		}
		return goal.tasks.filter((task) => task.is_completed);
	}, [goal?.tasks]);

	const handleChange = (event) => {
		const { name, value, type } = event.target;
		setForm((prev) => ({
			...prev,
			[name]: type === 'number' ? Number(value) : value,
		}));
	};

	const handleSubmit = (event) => {
		event.preventDefault();
		if (!goal?.id || !onSubmit) {
			return;
		}

		const objectivePayload = objectiveQuestions.map((question) => ({
			question_id: question.id,
			answer: formatObjectiveAnswer(question, objectiveAnswers[question.id]),
		}));
		onSubmit({
			...form,
			collaboration_quality: Number(form.collaboration_quality),
			satisfaction_score: Number(form.satisfaction_score),
			objective_answers: objectivePayload,
			department_id: goal?.department_id || '',
		});
	};

	if (!goal) {
		return null;
	}

	const handleObjectiveChange = (question, value) => {
		setObjectiveAnswers((prev) => ({
			...prev,
			[question.id]: value,
		}));
	};

	const objectiveSummary = useMemo(() => {
		if (!objectiveQuestions.length) {
			return null;
		}
		return objectiveQuestions.map((question) => ({
			id: question.id,
			title: question.title,
			type: question.answer_type,
			max: Number(question.max_score || 10),
			value: objectiveAnswers[question.id],
			options: question.answer_options || [],
		}));
	}, [objectiveQuestions, objectiveAnswers]);

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal self-assessment-modal" onClick={(event) => event.stopPropagation()}>
				<header className="modal-header">
					<h2>Самооценка по цели</h2>
					<p className="modal-subtitle">{goal.title}</p>
				</header>
				<form className="modal-body self-assessment-body" onSubmit={handleSubmit}>
					<div className="self-assessment-intro">
						<p>
							Расскажите о достигнутых результатах и ощущениях по завершению цели. Эти данные понадобятся для итоговой
							оценки и формирования плана развития.
						</p>
						<div className="self-assessment-meta">
							<span>Период: {new Date(goal.start_date).toLocaleDateString('ru-RU')} — {new Date(goal.end_date).toLocaleDateString('ru-RU')}</span>
							{goal.department_name && <span>Отдел: {goal.department_name}</span>}
						</div>
					</div>

					{completedTasks.length > 0 && (
						<div className="self-assessment-tasks">
							<h3>Выполненные задачи</h3>
							<ul>
								{completedTasks.map((task) => (
									<li key={task.id}>{task.title}</li>
								))}
							</ul>
						</div>
					)}

					{questionsError && <div className="objective-error">{questionsError}</div>}

					{questionsLoading ? (
						<div className="objective-loading">Загружаем объективные вопросы…</div>
					) : (
						objectiveSummary && objectiveSummary.length > 0 && (
							<div className="objective-block">
								<h3>Объективный блок оценки</h3>
								<p className="objective-hint">
									Ответы фиксируются в числовом формате — они используются для построения графиков и сравнений между отделами.
								</p>
								<div className="objective-grid">
									{objectiveSummary.map((question) => (
										<div key={question.id} className="objective-card">
											<header>
												<strong>{question.title}</strong>
												<span className="tag muted">{renderQuestionType(question.type)}</span>
											</header>
											{renderObjectiveControl({
												question,
												value: objectiveAnswers[question.id],
												onChange: (value) => handleObjectiveChange(question, value),
											})}
										</div>
									))}
								</div>
							</div>
						)
					)}

					<label className="self-assessment-field">
						<span>Достигнутые результаты *</span>
						<textarea
							name="achieved_results"
							value={form.achieved_results}
							onChange={handleChange}
							rows={3}
							placeholder="Опишите ключевые результаты и влияние на бизнес"
							required
						/>
					</label>

					<label className="self-assessment-field">
						<span>Личный вклад *</span>
						<textarea
							name="personal_contribution"
							value={form.personal_contribution}
							onChange={handleChange}
							rows={3}
							placeholder="Что удалось сделать лично вам?"
							required
						/>
					</label>

					<label className="self-assessment-field">
						<span>Новые навыки *</span>
						<textarea
							name="skills_acquired"
							value={form.skills_acquired}
							onChange={handleChange}
							rows={2}
							placeholder="Какие навыки или знания появились?"
							required
						/>
					</label>

					<label className="self-assessment-field">
						<span>Зоны развития *</span>
						<textarea
							name="improvements_needed"
							value={form.improvements_needed}
							onChange={handleChange}
							rows={2}
							placeholder="Что можно улучшить в следующий раз?"
							required
						/>
					</label>

					<div className="self-assessment-ratings">
						<label>
							<span>Качество совместной работы *</span>
							<select
								name="collaboration_quality"
								value={form.collaboration_quality}
								onChange={handleChange}
							>
								{gradeOptions.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						</label>
						<label>
							<span>Удовлетворённость результатом *</span>
							<select
								name="satisfaction_score"
								value={form.satisfaction_score}
								onChange={handleChange}
							>
								{gradeOptions.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						</label>
					</div>

					{error && <div className="self-assessment-error">{error}</div>}

					<footer className="modal-footer">
						<button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
							Позже
						</button>
						<button type="submit" className="btn primary" disabled={saving}>
							{saving ? 'Сохраняем…' : 'Отправить самооценку'}
						</button>
					</footer>
				</form>
			</div>
		</div>
	);
};

export default SelfAssessmentModal;

function renderQuestionType(type) {
	switch (type) {
		case 'scale':
			return 'Шкала';
		case 'numeric':
			return 'Числовой ответ';
		case 'single_choice':
			return 'Выбор варианта';
		case 'boolean':
			return 'Да / Нет';
		default:
			return 'Вопрос';
	}
}

function renderObjectiveControl({ question, value, onChange }) {
	if (question.type === 'scale') {
		const max = Number.isFinite(question.max) ? question.max : 10;
		const safeValue = Number.isFinite(value) ? value : Math.round(max / 2);
		return (
			<div className="objective-control slider">
				<input
					type="range"
					min="0"
					max={max}
					step="1"
					value={safeValue}
					onChange={(event) => onChange(Number(event.target.value))}
				/>
				<span className="slider-value">{safeValue} из {max}</span>
			</div>
		);
	}

	if (question.type === 'numeric') {
		return (
			<div className="objective-control">
				<input
					type="number"
					value={value === '' ? '' : Number(value)}
					placeholder="Введите точный ответ"
					onChange={(event) => onChange(event.target.value)}
				/>
			</div>
		);
	}

	if (question.type === 'single_choice') {
		return (
			<div className="objective-control choices">
				{(question.options || []).map((option) => (
					<label key={option} className="objective-radio">
						<input
							type="radio"
							name={`objective-${question.id}`}
							value={option}
							checked={value === option}
							onChange={(event) => onChange(event.target.value)}
						/>
						<span>{option}</span>
					</label>
				))}
			</div>
		);
	}

	if (question.type === 'boolean') {
		return (
			<label className="objective-control boolean">
				<input
					type="checkbox"
					checked={Boolean(value)}
					onChange={(event) => onChange(event.target.checked)}
				/>
				<span>{Boolean(value) ? 'Да' : 'Нет'}</span>
			</label>
		);
	}

	return (
		<div className="objective-control">
			<input
				type="text"
				value={value || ''}
				onChange={(event) => onChange(event.target.value)}
			/>
		</div>
	);
}

function formatObjectiveAnswer(question, rawValue) {
	if (question.answer_type === 'scale' || question.answer_type === 'numeric') {
		const numeric = Number(rawValue);
		return Number.isFinite(numeric) ? numeric : null;
	}
	if (question.answer_type === 'boolean') {
		return Boolean(rawValue);
	}
	return rawValue ?? '';
}
