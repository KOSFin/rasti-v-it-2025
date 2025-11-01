import { useEffect, useMemo, useState } from 'react';
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

	useEffect(() => {
		setForm(DEFAULT_FORM);
	}, [goal?.id]);

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
		onSubmit({
			...form,
			collaboration_quality: Number(form.collaboration_quality),
			satisfaction_score: Number(form.satisfaction_score),
		});
	};

	if (!goal) {
		return null;
	}

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
