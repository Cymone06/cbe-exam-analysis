import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import type { CoreCompetency, Exam, Result } from '@/types';
import type { LevelThresholds } from '@/types';
import { getMasteryForCompetency } from '@/utils/scoring';

interface Props {
  competencies: CoreCompetency[];
  exams: Exam[];
  results: Result[];
  thresholds: LevelThresholds;
}

export function CompetencyRadarChart({ competencies, exams, results, thresholds }: Props) {
  const data = competencies.map((c) => ({
    subject: c.shortName,
    value: getMasteryForCompetency(c.id, exams, results, thresholds).pct,
    fullMark: 100,
  }));

  return (
    <div role="img" aria-label={`Radar chart of core competencies: ${data.map((d) => `${d.subject} ${d.value}%`).join(', ')}`}>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
          <Radar
            name="Mastery"
            dataKey="value"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.3}
          />
          <Tooltip formatter={(v) => [`${v}%`, 'Mastery']} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
