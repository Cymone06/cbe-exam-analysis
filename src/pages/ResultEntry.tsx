import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ChevronLeft, AlertCircle } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { getLevel } from '@/utils/scoring';
import type { Exam, Result, ErrorType } from '@/types';

const ERROR_TYPES: ErrorType[] = [
  'Knowledge gap', 'Application error', 'Careless mistake',
  'Time pressure', 'Misread question',
];

export function ResultEntry() {
  const { id } = useParams<{ id: string }>();
  const { state } = useApp();
  const exam = state.exams.find((e) => e.id === id);

  if (!exam) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <Card>
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400">
              This exam no longer exists — it may have been deleted.
            </p>
            <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
              Head back to the <a href="#/exams" className="text-indigo-600 underline">exam list</a>.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return <ResultEntryForm exam={exam} />;
}

function ResultEntryForm({ exam }: { exam: Exam }) {
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const { results, slos, settings } = state;

  const existingResults = results.filter((r) => r.examId === exam.id);

  const [marks, setMarks] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const q of exam.questions) {
      const r = existingResults.find((res) => res.questionId === q.id);
      m[q.id] = r ? String(r.marksScored) : '';
    }
    return m;
  });

  const [errorTypes, setErrorTypes] = useState<Record<string, string>>(() => {
    const e: Record<string, string> = {};
    for (const q of exam.questions) {
      const r = existingResults.find((res) => res.questionId === q.id);
      e[q.id] = r?.errorType ?? '';
    }
    return e;
  });

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const n: Record<string, string> = {};
    for (const q of exam.questions) {
      const r = existingResults.find((res) => res.questionId === q.id);
      n[q.id] = r?.note ?? '';
    }
    return n;
  });

  // ─── Validation ────────────────────────────────────────────────────────────
  // Returns an issue message for a question's entered marks, or '' if valid.
  const markIssue = (qId: string, maxMarks: number): '' | string => {
    const raw = (marks[qId] ?? '').trim();
    if (raw === '') return '';
    const v = Number(raw);
    if (isNaN(v) || !isFinite(v)) return 'Marks must be a number.';
    if (v < 0) return 'Marks cannot be negative.';
    if (v > maxMarks) return `Marks cannot exceed the maximum of ${maxMarks}.`;
    return '';
  };

  const invalidQuestions = exam.questions.filter((q) => markIssue(q.id, q.maxMarks) !== '');

  // ─── Totals (valid entries only; clamped to [0, max]) ──────────────────────
  let totalScored = 0, totalMax = 0;
  for (const q of exam.questions) {
    const v = parseFloat(marks[q.id] ?? '');
    if (!isNaN(v) && markIssue(q.id, q.maxMarks) === '') {
      totalScored += Math.max(0, Math.min(v, q.maxMarks));
    }
    totalMax += q.maxMarks;
  }
  const overallPct = totalMax === 0 ? 0 : Math.round((totalScored / totalMax) * 100);
  const overallLevel = getLevel(overallPct, settings.thresholds);

  const handleSave = () => {
    if (invalidQuestions.length > 0) return;
    const newResults: Result[] = exam.questions
      .filter((q) => (marks[q.id] ?? '').trim() !== '' && !isNaN(parseFloat(marks[q.id])))
      .map((q) => ({
        id: existingResults.find((r) => r.questionId === q.id)?.id ?? `r-${q.id}-${Date.now()}`,
        examId: exam.id,
        questionId: q.id,
        marksScored: Math.max(0, Math.min(parseFloat(marks[q.id]), q.maxMarks)),
        errorType: (errorTypes[q.id] as ErrorType) || undefined,
        note: notes[q.id] || undefined,
      }));
    dispatch({ type: 'SAVE_RESULTS', payload: { examId: exam.id, results: newResults } });
    navigate('/exams');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/exams')}>
          <ChevronLeft size={16} /> Back
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">{exam.title}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Term {exam.term} · {exam.type} · {exam.date}</p>
        </div>
      </div>

      {exam.questions.length === 0 && (
        <Card>
          <p className="text-center text-gray-400 dark:text-gray-500 py-6 text-sm">
            This exam has no questions yet. Add questions in the exam editor first.
          </p>
        </Card>
      )}

      {invalidQuestions.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 px-4 py-3 rounded-xl text-sm">
          <AlertCircle size={16} className="shrink-0" />
          Please fix the highlighted marks — they can't be saved until they're between 0 and the maximum.
        </div>
      )}

      <div className="space-y-3">
        {exam.questions.map((q) => {
          const v = parseFloat(marks[q.id] ?? '');
          const issue = markIssue(q.id, q.maxMarks);
          const qPct = issue === '' && !isNaN(v) && q.maxMarks > 0
            ? Math.round((Math.max(0, Math.min(v, q.maxMarks)) / q.maxMarks) * 100)
            : null;
          const qLevel = qPct !== null ? getLevel(qPct, settings.thresholds) : null;
          const slo = slos.find((s) => s.id === q.sloId);

          return (
            <Card key={q.id}>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-gray-700 dark:text-gray-200">Q{q.number}</span>
                    {slo && <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400 font-mono">{slo.code}</span>}
                    {q.performanceIndicator && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{q.performanceIndicator}</p>}
                  </div>
                  {qLevel && <Badge level={qLevel} size="sm" />}
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-28">
                    <Input
                      type="number"
                      min={0}
                      max={q.maxMarks}
                      value={marks[q.id]}
                      onChange={(e) => setMarks((m) => ({ ...m, [q.id]: e.target.value }))}
                      aria-label={`Marks for question ${q.number}`}
                      aria-invalid={issue !== '' || undefined}
                      error={issue}
                      placeholder="Marks"
                    />
                  </div>
                  <span className="text-sm text-gray-400">/ {q.maxMarks}</span>
                  {qPct !== null && (
                    <div className="flex-1">
                      <ProgressBar pct={qPct} level={qLevel!} showLabel height={6} />
                    </div>
                  )}
                </div>

                {marks[q.id] !== '' && !isNaN(parseFloat(marks[q.id])) && issue === '' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Select
                      label="Error type (optional)"
                      value={errorTypes[q.id]}
                      onChange={(e) => setErrorTypes((et) => ({ ...et, [q.id]: e.target.value }))}
                      options={ERROR_TYPES.map((et) => ({ value: et, label: et }))}
                      placeholder="Select error type..."
                    />
                    <Input
                      label="Note (optional)"
                      value={notes[q.id]}
                      onChange={(e) => setNotes((n) => ({ ...n, [q.id]: e.target.value }))}
                      placeholder="e.g. confused area with perimeter"
                    />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Sticky totals bar */}
      <div className="sticky bottom-16 md:bottom-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-gray-800 dark:text-white">{overallPct}%</span>
          <Badge level={overallLevel} size="md" />
          <span className="text-sm text-gray-500 dark:text-gray-400">{totalScored}/{totalMax} marks</span>
        </div>
        <Button onClick={handleSave} disabled={invalidQuestions.length > 0}>
          <Save size={15} /> Save Results
        </Button>
      </div>
    </div>
  );
}
