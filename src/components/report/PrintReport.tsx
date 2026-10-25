import { useApp } from '@/store/AppContext';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  getMasteryForStrand,
  getMasteryForLearningArea,
  getTopStrengths,
  getTopGaps,
  LEVEL_LABELS,
} from '@/utils/scoring';

interface Props {
  comments: string;
  learningAreaId?: string;
}

export function PrintReport({ comments, learningAreaId }: Props) {
  const { state } = useApp();
  const { learner, learningAreas, strands, subStrands, slos, exams, results, settings } = state;
  const { thresholds } = settings;

  const targetArea = learningAreas.find((la) => la.id === learningAreaId) ?? learningAreas[0];
  const areaStrands = strands
    .filter((s) => s.learningAreaId === targetArea?.id)
    .sort((a, b) => a.order - b.order);

  const areaMastery = targetArea
    ? getMasteryForLearningArea(targetArea.id, exams, results, thresholds)
    : null;

  const strengths = getTopStrengths(3, slos, exams, results, thresholds);
  const gaps = getTopGaps(3, slos, exams, results, thresholds);

  const today = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date());

  return (
    <div
      id="print-report"
      className="hidden print:block w-full max-w-[210mm] mx-auto bg-white text-gray-900 font-sans text-sm p-8"
      aria-hidden="true"
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-indigo-700">CBE Learner Progress Report</h1>
          <p className="text-gray-500 mt-1">{today}</p>
        </div>
        <div className="text-right text-xs text-gray-400">
          <p>Competency-Based Education</p>
          <p>NaCCA Curriculum Framework</p>
        </div>
      </div>

      {/* Learner Profile */}
      {learner && (
        <div className="grid grid-cols-2 gap-4 mb-6 bg-indigo-50 rounded-lg p-4">
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Learner</p>
            <p className="font-bold text-lg">{learner.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Grade</p>
            <p className="font-medium">Basic {learner.grade}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">School</p>
            <p className="font-medium">{learner.school}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Academic Year</p>
            <p className="font-medium">{learner.year}</p>
          </div>
        </div>
      )}

      {/* Overall Level */}
      {targetArea && areaMastery && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-gray-700 mb-2">Overall Level — {targetArea.name}</h2>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold text-indigo-700">{areaMastery.pct}%</span>
            <div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                areaMastery.level === 'EE' ? 'bg-green-100 text-green-700'
                : areaMastery.level === 'ME' ? 'bg-blue-100 text-blue-700'
                : areaMastery.level === 'AE' ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
              }`}>
                {areaMastery.level} — {LEVEL_LABELS[areaMastery.level]}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Strand breakdown */}
      {areaStrands.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-gray-700 mb-2">Performance by Strand</h2>
          <div className="space-y-2">
            {areaStrands.map((strand) => {
              const m = getMasteryForStrand(strand.id, slos, exams, results, thresholds, subStrands);
              return (
                <div key={strand.id} className="flex items-center gap-3">
                  <span className="w-40 text-xs font-medium text-gray-600 truncate">{strand.name}</span>
                  <div className="flex-1">
                    <ProgressBar pct={m.pct} level={m.level} height={6} />
                  </div>
                  <Badge level={m.level} size="sm" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="mb-4">
          <h2 className="text-base font-bold text-gray-700 mb-1">Strengths</h2>
          <ul className="list-disc list-inside space-y-1 text-xs text-gray-700">
            {strengths.map(({ slo, mastery }) => (
              <li key={slo.id}>
                <strong>{slo.code}</strong>: {slo.description} — <Badge level={mastery.level} size="sm" /> ({mastery.pct}%)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Areas for improvement */}
      {gaps.length > 0 && (
        <div className="mb-4">
          <h2 className="text-base font-bold text-gray-700 mb-1">Areas for Further Growth</h2>
          <ul className="list-disc list-inside space-y-1 text-xs text-gray-700">
            {gaps.map(({ slo, mastery }) => (
              <li key={slo.id}>
                <strong>{slo.code}</strong>: {slo.description} — <Badge level={mastery.level} size="sm" /> ({mastery.pct}%)
                <br />
                <span className="text-amber-600 ml-4">
                  {mastery.level === 'BE'
                    ? 'Building foundations — every step forward counts.'
                    : 'Approaching expectations — next step is Meeting Expectations.'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Comments */}
      <div className="mb-4">
        <h2 className="text-base font-bold text-gray-700 mb-1">Teacher / Parent Comments</h2>
        <div className="border border-gray-300 rounded-lg p-3 min-h-[60px] text-xs text-gray-700">
          {comments || <span className="text-gray-400 italic">No comments added.</span>}
        </div>
      </div>

      {/* Next Steps */}
      <div className="mb-6">
        <h2 className="text-base font-bold text-gray-700 mb-1">Next Steps</h2>
        <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
          {gaps.slice(0, 2).map(({ slo }) => (
            <li key={slo.id}>Focus on <strong>{slo.code}</strong>: {slo.description}</li>
          ))}
          {gaps.length === 0 && <li>Maintain current effort and aim for Exceeding Expectations in all strands.</li>}
        </ul>
      </div>

      {/* Signature line */}
      <div className="border-t border-gray-200 pt-4 grid grid-cols-2 gap-8 text-xs text-gray-400">
        <div>
          <div className="border-b border-gray-300 pb-5 mb-1" />
          Teacher Signature & Date
        </div>
        <div>
          <div className="border-b border-gray-300 pb-5 mb-1" />
          Parent / Guardian Signature & Date
        </div>
      </div>
    </div>
  );
}
