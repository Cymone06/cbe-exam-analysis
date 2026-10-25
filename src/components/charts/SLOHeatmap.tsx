import { useState } from 'react';
import type { SLO, Exam, Result, LevelThresholds } from '@/types';
import { getLevel, LEVEL_COLOURS } from '@/utils/scoring';

/** Dark text on the bright level colours for WCAG AA contrast on heatmap cells. */
const CELL_TEXT_COLOUR = '#111827';

interface Props {
  slos: SLO[];
  exams: Exam[];
  results: Result[];
  thresholds: LevelThresholds;
}

export function SLOHeatmap({ slos, exams, results, thresholds }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  if (slos.length === 0 || exams.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">No data for heatmap yet.</p>;
  }

  const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date));

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(d));

  const getCellPct = (slo: SLO, exam: Exam): number | null => {
    const questions = exam.questions.filter((q) => q.sloId === slo.id);
    if (questions.length === 0) return null;
    let scored = 0; let max = 0;
    for (const q of questions) {
      const r = results.find((res) => res.questionId === q.id);
      if (r) { scored += r.marksScored; max += q.maxMarks; }
    }
    return max === 0 ? null : Math.round((scored / max) * 100);
  };

  return (
    <div
      role="img"
      aria-label="Heatmap of SLO performance across exams"
      className="overflow-x-auto"
    >
      <table className="text-xs border-collapse" aria-label="SLO Heatmap">
        <thead>
          <tr>
            <th className="text-left pr-4 py-1 text-gray-600 dark:text-gray-400 min-w-[200px]">SLO</th>
            {sorted.map((e) => (
              <th key={e.id} className="px-2 py-1 text-center text-gray-600 dark:text-gray-400 whitespace-nowrap font-medium">
                {formatDate(e.date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slos.map((slo) => (
            <tr key={slo.id}>
              <td className="pr-4 py-1 text-gray-700 dark:text-gray-300 font-medium" title={slo.description}>
                {slo.code}
              </td>
              {sorted.map((exam) => {
                const pct = getCellPct(slo, exam);
                const level = pct !== null ? getLevel(pct, thresholds) : null;
                const bg = level ? LEVEL_COLOURS[level] : undefined;
                return (
                  <td key={exam.id} className="px-1 py-1 text-center">
                    <button
                      className="w-10 h-7 rounded text-xs font-semibold transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      style={{ backgroundColor: bg ?? '#e5e7eb', color: bg ? CELL_TEXT_COLOUR : '#4b5563' }}
                      aria-label={pct !== null ? `${slo.code} in exam ${exam.title}: ${pct}%` : `${slo.code} in exam ${exam.title}: no data`}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ x: rect.left, y: rect.top, text: pct !== null ? `${slo.code}: ${pct}%` : 'No data' });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onFocus={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ x: rect.left, y: rect.top, text: pct !== null ? `${slo.code}: ${pct}%` : 'No data' });
                      }}
                      onBlur={() => setTooltip(null)}
                    >
                      {pct !== null ? `${pct}` : '–'}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg pointer-events-none"
          style={{ top: tooltip.y - 32, left: tooltip.x }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
