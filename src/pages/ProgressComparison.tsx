import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { getMasteryForSLO } from '@/utils/scoring';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function ProgressComparison() {
  const { state } = useApp();
  const { exams, results, slos, subStrands, strands, learningAreas, settings } = state;
  const { thresholds } = settings;

  const [areaId, setAreaId] = useState(learningAreas[0]?.id ?? '');
  const [termFilter, setTermFilter] = useState<'' | 1 | 2 | 3>('');
  const [examAId, setExamAId] = useState('');
  const [examBId, setExamBId] = useState('');

  const areaExams = exams
    .filter((e) => e.learningAreaId === areaId)
    .filter((e) => termFilter === '' || e.term === termFilter)
    .sort((a, b) => a.date.localeCompare(b.date));

  const examA = areaExams.find((e) => e.id === examAId);
  const examB = areaExams.find((e) => e.id === examBId);

  // SLOs covered by both exams
  const sloIdsA = new Set(examA?.questions.map((q) => q.sloId) ?? []);
  const sloIdsB = new Set(examB?.questions.map((q) => q.sloId) ?? []);
  const sharedSLOs = slos.filter((s) => sloIdsA.has(s.id) || sloIdsB.has(s.id));

  const areaStrands = strands.filter((s) => s.learningAreaId === areaId);
  const relevantSubStrands = subStrands.filter((ss) => areaStrands.some((s) => s.id === ss.strandId));
  const areaSLOs = sharedSLOs.filter((slo) => relevantSubStrands.some((ss) => ss.id === slo.subStrandId));

  const getMastery = (sloId: string, examId: string) => {
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return null;
    return getMasteryForSLO(sloId, [exam], results, thresholds);
  };

  // Overall delta
  const calcOverallPct = (examId: string) => {
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return null;
    let s = 0, m = 0;
    for (const q of exam.questions) {
      const r = results.find((res) => res.questionId === q.id);
      if (r) { s += r.marksScored; m += q.maxMarks; }
    }
    return m === 0 ? null : Math.round((s / m) * 100);
  };

  const pctA = examAId ? calcOverallPct(examAId) : null;
  const pctB = examBId ? calcOverallPct(examBId) : null;
  const delta = pctA !== null && pctB !== null ? pctB - pctA : null;

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(d));

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Progress Comparison</h1>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Select
            label="Learning Area"
            value={areaId}
            onChange={(e) => { setAreaId(e.target.value); setExamAId(''); setExamBId(''); }}
            options={learningAreas.map((la) => ({ value: la.id, label: la.name }))}
          />
          <Select
            label="Term"
            value={termFilter === '' ? '' : String(termFilter)}
            onChange={(e) => { setTermFilter(e.target.value === '' ? '' : (Number(e.target.value) as 1 | 2 | 3)); setExamAId(''); setExamBId(''); }}
            options={[
              { value: '', label: 'All terms' },
              { value: '1', label: 'Term 1' },
              { value: '2', label: 'Term 2' },
              { value: '3', label: 'Term 3' },
            ]}
          />
          <Select
            label="Exam A (earlier)"
            value={examAId}
            onChange={(e) => setExamAId(e.target.value)}
            options={areaExams.filter((e) => e.id !== examBId).map((e) => ({ value: e.id, label: `${e.title} (${formatDate(e.date)})` }))}
            placeholder="Select exam..."
          />
          <Select
            label="Exam B (later)"
            value={examBId}
            onChange={(e) => setExamBId(e.target.value)}
            options={areaExams.filter((e) => e.id !== examAId).map((e) => ({ value: e.id, label: `${e.title} (${formatDate(e.date)})` }))}
            placeholder="Select exam..."
          />
        </div>
      </Card>

      {/* Summary banner */}
      {delta !== null && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
          delta > 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'
          : delta < 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
        }`}>
          {delta > 0 ? <TrendingUp size={18} /> : delta < 0 ? <TrendingDown size={18} /> : <Minus size={18} />}
          <span>
            {delta > 0
              ? `Great progress! Overall score improved by ${delta} percentage points (${pctA}% → ${pctB}%).`
              : delta < 0
              ? `Overall score changed by ${delta} percentage points (${pctA}% → ${pctB}%). Keep practising — improvement takes time.`
              : `Overall score stayed the same at ${pctA}%.`}
          </span>
        </div>
      )}

      {/* SLO comparison table */}
      {examAId && examBId && areaSLOs.length > 0 && (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400 font-semibold">SLO</th>
                  <th className="text-center px-4 py-3 text-gray-600 dark:text-gray-400 font-semibold">Exam A</th>
                  <th className="text-center px-4 py-3 text-gray-600 dark:text-gray-400 font-semibold">Exam B</th>
                  <th className="text-center px-4 py-3 text-gray-600 dark:text-gray-400 font-semibold">Change</th>
                </tr>
              </thead>
              <tbody>
                {areaSLOs.map((slo) => {
                  const mA = getMastery(slo.id, examAId);
                  const mB = getMastery(slo.id, examBId);
                  const diff = mA && mB ? mB.pct - mA.pct : null;
                  return (
                    <tr key={slo.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-3">
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 text-xs">{slo.code}</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{slo.description}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {mA ? <><span className="font-medium">{mA.pct}%</span> <Badge level={mA.level} size="sm" /></> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {mB ? <><span className="font-medium">{mB.pct}%</span> <Badge level={mB.level} size="sm" /></> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {diff !== null ? (
                          <span className={`inline-flex items-center gap-1 font-semibold ${
                            diff > 0 ? 'text-green-600 dark:text-green-400'
                            : diff < 0 ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-400'
                          }`}>
                            {diff > 0 ? <TrendingUp size={14} /> : diff < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                            {diff > 0 ? `+${diff}` : diff}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {examAId && examBId && areaSLOs.length === 0 && (
        <Card>
          <p className="text-center text-gray-400 dark:text-gray-500 py-6 text-sm">No shared SLOs between the selected exams.</p>
        </Card>
      )}

      {(!examAId || !examBId) && (
        <Card>
          <p className="text-center text-gray-400 dark:text-gray-500 py-6 text-sm">Select two exams above to compare progress.</p>
        </Card>
      )}
    </div>
  );
}
