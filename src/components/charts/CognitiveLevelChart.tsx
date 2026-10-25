import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { CognitiveLevel, Exam, Result, LevelThresholds } from '@/types';
import { getLevel, LEVEL_COLOURS } from '@/utils/scoring';

const COGNITIVE_LEVELS: CognitiveLevel[] = ['Recall', 'Understanding', 'Application', 'Higher-order'];
const LEVEL_COLOURS_COG = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'];

interface Props {
  exams: Exam[];
  results: Result[];
  thresholds: LevelThresholds;
}

export function CognitiveLevelChart({ exams, results, thresholds }: Props) {
  const data = COGNITIVE_LEVELS.map((cl, i) => {
    let scored = 0; let max = 0;
    for (const exam of exams) {
      for (const q of exam.questions) {
        if (q.cognitiveLevel !== cl) continue;
        const r = results.find((res) => res.questionId === q.id);
        if (r) { scored += r.marksScored; max += q.maxMarks; }
      }
    }
    const pct = max === 0 ? 0 : Math.round((scored / max) * 100);
    const level = getLevel(pct, thresholds);
    return { name: cl, pct, level, colour: max > 0 ? LEVEL_COLOURS[level] : LEVEL_COLOURS_COG[i] };
  });

  return (
    <div role="img" aria-label={`Bar chart of mastery by cognitive level: ${data.map((d) => `${d.name} ${d.pct}%`).join(', ')}`}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => [`${v}%`, 'Mastery']} />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.colour} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
