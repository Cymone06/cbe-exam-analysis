import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, ClipboardCheck } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getExamSummary } from '@/utils/scoring';
import { useState } from 'react';

export function ExamList() {
  const { state, dispatch } = useApp();
  const { exams, results, learningAreas, settings } = state;
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getLAName = (id: string) => learningAreas.find((la) => la.id === id)?.name ?? id;

  const grouped: Record<number, typeof exams> = { 1: [], 2: [], 3: [] };
  for (const e of exams) grouped[e.term].push(e);
  for (const term of [1, 2, 3]) grouped[term].sort((a, b) => b.date.localeCompare(a.date));

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(d));

  const confirmDelete = () => {
    if (deleteId) { dispatch({ type: 'DELETE_EXAM', payload: deleteId }); setDeleteId(null); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Exams</h1>
        <Link to="/exams/new"><Button size="sm"><Plus size={15} /> New Exam</Button></Link>
      </div>

      {[1, 2, 3].map((term) => (
        grouped[term].length > 0 && (
          <section key={term}>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Term {term}</h2>
            <div className="space-y-2">
              {grouped[term].map((exam) => {
                const summary = getExamSummary(exam, results, settings.thresholds);
                const hasResults = results.some((r) => r.examId === exam.id);
                return (
                  <Card key={exam.id} padding={false}>
                    <div className="flex items-center gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 dark:text-white truncate">{exam.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(exam.date)} · {getLAName(exam.learningAreaId)} · {exam.type}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasResults ? (
                          <>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{summary.pct}%</span>
                            <Badge level={summary.level} size="sm" />
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">No results</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Link to={`/exams/${exam.id}/results`}>
                          <Button variant="ghost" size="sm" aria-label="Enter results">
                            <ClipboardCheck size={15} />
                          </Button>
                        </Link>
                        <Link to={`/exams/${exam.id}`}>
                          <Button variant="ghost" size="sm" aria-label="Edit exam">
                            <Edit size={15} />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" aria-label="Delete exam" onClick={() => setDeleteId(exam.id)}>
                          <Trash2 size={15} className="text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )
      ))}

      {exams.length === 0 && (
        <Card>
          <p className="text-center text-gray-400 dark:text-gray-500 py-8">
            No exams yet. <Link to="/exams/new" className="text-indigo-600 underline">Create your first exam.</Link>
          </p>
        </Card>
      )}

      <Modal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Delete Exam"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-300">
          Are you sure you want to delete this exam? All associated results will also be removed. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
