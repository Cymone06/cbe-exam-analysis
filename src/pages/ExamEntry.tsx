import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { SLOPicker } from '@/components/SLOPicker';
import type { Exam, Question, ExamType, CognitiveLevel } from '@/types';

const EXAM_TYPES: ExamType[] = ['Formative', 'CAT', 'Mid-term', 'End-term'];
const COGNITIVE_LEVELS: CognitiveLevel[] = ['Recall', 'Understanding', 'Application', 'Higher-order'];

let idSequence = 0;
/** Deterministic, pure-in-render unique id generator (pure JS counter, no Date.now/Math.random). */
function nextId(prefix: string): string {
  idSequence += 1;
  return `${prefix}-${idSequence}`;
}

function newQuestion(examId: string, number: number): Question {
  return {
    id: nextId(`q-${examId}`),
    examId,
    number,
    maxMarks: 10,
    sloId: '',
    performanceIndicator: '',
    cognitiveLevel: 'Understanding',
    competencyIds: [],
  };
}

export function ExamEntry() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const { learningAreas, competencies, exams } = state;

  const existing = exams.find((e) => e.id === id);

  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [type, setType] = useState<ExamType>(existing?.type ?? 'Formative');
  const [term, setTerm] = useState<1 | 2 | 3>(existing?.term ?? 1);
  const [date, setDate] = useState(existing?.date ?? new Date().toISOString().slice(0, 10));
  const [learningAreaId, setLearningAreaId] = useState(existing?.learningAreaId ?? (learningAreas[0]?.id ?? ''));
  // The id is fixed once per mount via lazy state (stable across re-renders).
  const [examId] = useState(() => existing?.id ?? nextId('exam'));
  const [questions, setQuestions] = useState<Question[]>(() => existing?.questions ?? [newQuestion(examId, 1)]);
  const [submitted, setSubmitted] = useState(false);

  const unlinkedCount = questions.filter((q) => !q.sloId).length;

  // ─── Validation ────────────────────────────────────────────────────────────
  const maxIssue = (idx: number): '' | string => {
    const v = questions[idx].maxMarks;
    if (isNaN(v) || !isFinite(v) || v < 1) return 'Max marks must be at least 1.';
    return '';
  };
  const invalidMaxIdxs = questions.map((_, i) => i).filter((i) => maxIssue(i) !== '');

  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    setQuestions((qs) => qs.map((q, i) => i === idx ? { ...q, ...patch } : q));
  };

  const addQuestion = () => {
    setQuestions((qs) => [...qs, newQuestion(examId, qs.length + 1)]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions((qs) => qs.filter((_, i) => i !== idx).map((q, i) => ({ ...q, number: i + 1 })));
  };

  const handleSave = () => {
    setSubmitted(true);
    if (!title || !learningAreaId) return;
    if (step === 1) { setStep(2); return; }
    if (unlinkedCount > 0 || invalidMaxIdxs.length > 0) return;

    const exam: Exam = { id: examId, title, type, term, date, learningAreaId, questions };
    if (isEdit) {
      dispatch({ type: 'UPDATE_EXAM', payload: exam });
    } else {
      dispatch({ type: 'ADD_EXAM', payload: exam });
    }
    navigate('/exams');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
        {isEdit ? 'Edit Exam' : 'New Exam'}
      </h1>

      {/* Step indicator */}
      <div className="flex gap-4 text-sm">
        {(['1. Exam Details', '2. Questions'] as const).map((label, i) => (
          <span key={label} className={`font-medium ${i + 1 === step ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
            {label}
          </span>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <div className="space-y-4">
            <Input
              label="Exam Title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={submitted && !title ? 'Title is required' : ''}
              placeholder="e.g. Mathematics Mid-term — Term 1"
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Type"
                value={type}
                onChange={(e) => setType(e.target.value as ExamType)}
                options={EXAM_TYPES.map((t) => ({ value: t, label: t }))}
              />
              <Select
                label="Term"
                value={String(term)}
                onChange={(e) => setTerm(Number(e.target.value) as 1 | 2 | 3)}
                options={[1, 2, 3].map((t) => ({ value: String(t), label: `Term ${t}` }))}
              />
            </div>
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Select
              label="Learning Area *"
              value={learningAreaId}
              onChange={(e) => setLearningAreaId(e.target.value)}
              options={learningAreas.map((la) => ({ value: la.id, label: la.name }))}
              placeholder="Select learning area..."
              error={submitted && !learningAreaId ? 'Learning area is required' : ''}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => navigate('/exams')}>Cancel</Button>
              <Button onClick={() => { setSubmitted(true); if (title && learningAreaId) setStep(2); }}>
                Next: Questions
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && (
        <>
          {submitted && unlinkedCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 px-4 py-3 rounded-xl text-sm">
              <AlertCircle size={16} />
              {unlinkedCount} question{unlinkedCount > 1 ? 's' : ''} must be linked to an SLO before saving.
            </div>
          )}
          {invalidMaxIdxs.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 px-4 py-3 rounded-xl text-sm">
              <AlertCircle size={16} />
              Each question needs at least 1 mark for its maximum.
            </div>
          )}

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <Card key={q.id} header={
                <div className="flex justify-between items-center">
                  <span>Question {q.number}</span>
                  {questions.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeQuestion(idx)} aria-label="Remove question">
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  )}
                </div>
              }>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Max Marks"
                      type="number"
                      min={1}
                      value={q.maxMarks}
                      onChange={(e) => updateQuestion(idx, { maxMarks: Number(e.target.value) || 0 })}
                      error={submitted && maxIssue(idx) !== '' ? maxIssue(idx) : ''}
                    />
                    <Select
                      label="Cognitive Level"
                      value={q.cognitiveLevel}
                      onChange={(e) => updateQuestion(idx, { cognitiveLevel: e.target.value as CognitiveLevel })}
                      options={COGNITIVE_LEVELS.map((cl) => ({ value: cl, label: cl }))}
                    />
                  </div>
                  <Input
                    label="Performance Indicator"
                    value={q.performanceIndicator}
                    onChange={(e) => updateQuestion(idx, { performanceIndicator: e.target.value })}
                    placeholder="What should the learner be able to do?"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link to SLO *</p>
                    <SLOPicker
                      learningAreaId={learningAreaId}
                      value={q.sloId}
                      onChange={(sloId) => updateQuestion(idx, { sloId })}
                      error={submitted && !q.sloId ? 'SLO is required' : ''}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Core Competencies</p>
                    <div className="flex flex-wrap gap-2">
                      {competencies.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const has = q.competencyIds.includes(c.id);
                            updateQuestion(idx, {
                              competencyIds: has
                                ? q.competencyIds.filter((id) => id !== c.id)
                                : [...q.competencyIds, c.id],
                            });
                          }}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                            q.competencyIds.includes(c.id)
                              ? 'bg-indigo-100 border-indigo-400 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-500 dark:text-indigo-300'
                              : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400 hover:border-indigo-300'
                          }`}
                          aria-pressed={q.competencyIds.includes(c.id)}
                        >
                          {c.shortName}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            <Button variant="secondary" onClick={addQuestion} className="w-full">
              <Plus size={15} /> Add Question
            </Button>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => navigate('/exams')}>Cancel</Button>
                <Button onClick={handleSave}>Save Exam</Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
