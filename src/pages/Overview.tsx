/**
 * Family or class overview (REQ-ML5): all learners × learning areas with the
 * latest level per area, filterable by grade; clicking a learner switches to
 * them. Data for non-active learners comes from the cached account doc.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/auth/AuthContext';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { learnerInitials } from '@/components/learners/LearnerSwitcher';
import { getLevel } from '@/utils/scoring';
import { loadAccountDoc } from '@/store/db';
import type { LearnerWorkspace } from '@/types';

interface Cell { pct: number; level: 'EE' | 'ME' | 'AE' | 'BE'; examTitle: string | null }

export function Overview() {
  const { state, switchLearner } = useApp();
  const { accountId } = useAuth();
  const navigate = useNavigate();  const [gradeFilter, setGradeFilter] = useState('all');
  const [workspaces, setWorkspaces] = useState<Record<string, LearnerWorkspace>>({});

  useEffect(() => {
    void (async () => {
      const doc = await loadAccountDoc(accountId);
      if (doc) setWorkspaces(doc.workspaces as Record<string, LearnerWorkspace>);
    })();
  }, [accountId, state.learners]);

  /** latest level per area for one learner — latest dated exam with results in that area */
  function latestByArea(ws: LearnerWorkspace | undefined): Record<string, Cell> {
    const out: Record<string, Cell> = {};
    if (!ws) return out;
    for (const la of ws.learningAreas) {
      const areaExams = ws.exams
        .filter((e) => e.learningAreaId === la.id && e.questions.length > 0)
        .sort((a, b) => b.date.localeCompare(a.date));
      for (const exam of areaExams) {
        const withResults = exam.questions.filter((q) => ws.results.some((r) => r.examId === exam.id && r.questionId === q.id));
        if (withResults.length === 0) continue;
        let scored = 0;
        let max = 0;
        for (const q of withResults) {
          const r = ws.results.find((x) => x.examId === exam.id && x.questionId === q.id)!;
          max += q.maxMarks;
          scored += Math.max(0, Math.min(r.marksScored, q.maxMarks));
        }
        const pct = max > 0 ? Math.round((scored / max) * 100) : 0;
        out[la.id] = { pct, level: getLevel(pct, state.settings.thresholds), examTitle: exam.title };
        break; // latest only
      }
    }
    return out;
  }

  const learners = useMemo(() => state.learners.filter((l) => !l.archivedAt), [state.learners]);
  const grades = useMemo(
    () => Array.from(new Set(learners.map((l) => l.grade))).sort((a, b) => a - b),
    [learners],
  );
  const visible = gradeFilter === 'all' ? learners : learners.filter((l) => String(l.grade) === gradeFilter);

  const activeWs = state.activeLearnerId
    ? { ...({ learningAreas: state.learningAreas, strands: state.strands, subStrands: state.subStrands, slos: state.slos, competencies: state.competencies, exams: state.exams, results: state.results, actionPlan: state.actionPlan }) as unknown as LearnerWorkspace }
    : undefined;

  const areaNames = useMemo(
    () => Array.from(new Set(state.learningAreas.map((a) => a.id)))
      .map((id) => state.learningAreas.find((a) => a.id === id)!
      ),
    [state.learningAreas],
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Family or class overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Every learner's latest level, side by side. Tap a learner to open their data.
          </p>
        </div>
        <Select
          id="grade-filter"
          label="Grade"
          className="w-40"
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          options={[{ value: 'all', label: 'All grades' }, ...grades.map((g) => ({ value: String(g), label: `Basic ${g}` }))]}
        />
      </div>

      {visible.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No learners to show yet — add learners on the "My Learners" page.
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Latest level per learning area for each learner</caption>
            <thead>
              <tr className="text-left">
                <th scope="col" className="py-2 pr-3 font-semibold text-gray-700 dark:text-gray-300">Learner</th>
                {areaNames.map((a) => (
                  <th key={a.id} scope="col" className="py-2 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{a.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => {
                const ws = l.id === state.activeLearnerId ? activeWs : workspaces[l.id];
                const cells = latestByArea(ws);
                return (
                  <tr key={l.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-3 pr-3">
                      <button
                        type="button"
                        onClick={() => { void switchLearner(l.id); navigate('/'); }}
                        className="flex items-center gap-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg py-1 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        aria-label={`Switch to ${l.name}, Basic ${l.grade}`}
                      >
                        <span
                          aria-hidden="true"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: l.colour ?? '#6366f1' }}
                        >
                          {learnerInitials(l.name)}
                        </span>
                        <span>
                          <span className="font-medium text-gray-800 dark:text-gray-100">{l.name}</span>
                          <span className="block text-xs text-gray-400">Basic {l.grade}</span>
                        </span>
                      </button>
                    </td>
                    {areaNames.map((a) => {
                      const cell = cells[a.id];
                      return (
                        <td key={a.id} className="py-3 px-3">
                          {cell ? (
                            <span className="inline-flex flex-col gap-1">
                              <Badge level={cell.level} size="sm" />
                              <span className="text-xs text-gray-400">{cell.pct}% · {cell.examTitle}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">No results yet</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
