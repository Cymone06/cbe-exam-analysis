import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { Exam, LearningArea, Result } from '@/types';
import type { LevelThresholds } from '@/types';
import { getExamSummary } from '@/utils/scoring';

interface Props {
  exams: Exam[];
  results: Result[];
  learningAreas: LearningArea[];
  thresholds: LevelThresholds;
  filterAreaId?: string;
}

export function TrendLineChart({ exams, results, learningAreas, thresholds, filterAreaId }: Props) {
  const filteredAreas = filterAreaId
    ? learningAreas.filter((la) => la.id === filterAreaId)
    : learningAreas;

  // Build data points per exam date
  const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date));

  // Group by date+area
  const dateSet = new Set(sorted.map((e) => e.date));
  const dataPoints = Array.from(dateSet).map((date) => {
    const point: Record<string, string | number> = { date };
    for (const la of filteredAreas) {
      const dayExams = sorted.filter((e) => e.date === date && e.learningAreaId === la.id);
      if (dayExams.length > 0) {
        const pcts = dayExams.map((e) => getExamSummary(e, results, thresholds).pct);
        point[la.name] = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
      }
    }
    return point;
  });

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(d));

  return (
    <div role="img" aria-label="Exam score trend line chart showing performance over time">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={dataPoints} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(v) => [`${v}%`]} labelFormatter={formatDate} />
          <Legend />
          <ReferenceLine y={thresholds.EE} stroke="#22c55e" strokeDasharray="4 2" label={{ value: 'EE', fill: '#22c55e', fontSize: 10 }} />
          <ReferenceLine y={thresholds.ME} stroke="#3b82f6" strokeDasharray="4 2" label={{ value: 'ME', fill: '#3b82f6', fontSize: 10 }} />
          {filteredAreas.map((la) => (
            <Line
              key={la.id}
              type="monotone"
              dataKey={la.name}
              stroke={la.colour}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
