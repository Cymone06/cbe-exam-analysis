import { useState } from 'react';
import { Printer, Download } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Select } from '@/components/ui/Select';
import {
  getMasteryForStrand,
  getMasteryForLearningArea,
  getTopStrengths,
  getTopGaps,
  LEVEL_LABELS,
} from '@/utils/scoring';
import { downloadReportPDF } from '@/utils/reportPdf';
import { PrintReport } from '@/components/report/PrintReport';

export function Report() {
  const { state } = useApp();
  const { learner, learningAreas, strands, subStrands, slos, exams, results, settings } = state;
  const { thresholds } = settings;

  const [areaId, setAreaId] = useState(learningAreas[0]?.id ?? '');
  const [comments, setComments] = useState('');

  const targetArea = learningAreas.find((la) => la.id === areaId);
  const areaStrands = strands
    .filter((s) => s.learningAreaId === areaId)
    .sort((a, b) => a.order - b.order);

  const areaMastery = targetArea
    ? getMasteryForLearningArea(areaId, exams, results, thresholds)
    : null;

  const strengths = getTopStrengths(3, slos, exams, results, thresholds);
  const gaps = getTopGaps(3, slos, exams, results, thresholds);

  const today = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date());

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-5 print:hidden">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">CBE Learner Report</h1>
          <div className="flex items-center gap-2">
            <Select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              options={learningAreas.map((la) => ({ value: la.id, label: la.name }))}
              aria-label="Select learning area for report"
            />
            <Button onClick={() => window.print()}>
              <Printer size={15} /> Export PDF
            </Button>
            <Button
              variant="secondary"
              onClick={() => { void downloadReportPDF(state, comments); }}
              aria-label="Download report as a real PDF file"
            >
              <Download size={15} /> Download PDF
            </Button>
          </div>
        </div>

        {/* Preview card */}
        <Card className="border-2 border-indigo-200 dark:border-indigo-700">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-indigo-200 dark:border-indigo-700 pb-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-indigo-700 dark:text-indigo-400">CBE Learner Progress Report</h2>
              <p className="text-sm text-gray-500 mt-1">{today}</p>
            </div>
          </div>

          {/* Learner */}
          {learner && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 mb-4">
              {([['Learner', learner.name], ['Grade', `Basic ${learner.grade}`], ['School', learner.school], ['Year', learner.year]] as [string, string][]).map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">{label}</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Overall level */}
          {targetArea && areaMastery && (
            <div className="mb-4">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Overall — {targetArea.name}</h3>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-bold text-indigo-700 dark:text-indigo-400">{areaMastery.pct}%</span>
                <div>
                  <Badge level={areaMastery.level} size="lg" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{LEVEL_LABELS[areaMastery.level]}</p>
                </div>
              </div>
            </div>
          )}

          {/* Strands */}
          {areaStrands.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Performance by Strand</h3>
              <div className="space-y-2">
                {areaStrands.map((strand) => {
                  const m = getMasteryForStrand(strand.id, slos, exams, results, thresholds, subStrands);
                  return (
                    <div key={strand.id} className="flex items-center gap-3">
                      <span className="w-44 text-sm text-gray-600 dark:text-gray-400 truncate">{strand.name}</span>
                      <div className="flex-1"><ProgressBar pct={m.pct} level={m.level} /></div>
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
              <h3 className="font-semibold text-green-700 dark:text-green-400 mb-1">Strengths</h3>
              <ul className="space-y-1">
                {strengths.map(({ slo, mastery }) => (
                  <li key={slo.id} className="flex items-center gap-2 text-sm">
                    <Badge level={mastery.level} size="sm" />
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">{slo.code}</span>
                    <span className="text-gray-600 dark:text-gray-400 truncate">{slo.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gaps */}
          {gaps.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-1">Areas for Further Growth</h3>
              <ul className="space-y-1">
                {gaps.map(({ slo, mastery }) => (
                  <li key={slo.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Badge level={mastery.level} size="sm" />
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">{slo.code}</span>
                      <span className="text-gray-600 dark:text-gray-400 truncate">{slo.description}</span>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 ml-12">
                      {mastery.level === 'BE' ? 'Building foundations — every step forward counts.' : 'Approaching expectations — next step is ME.'}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Comments */}
          <div className="mb-4">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Teacher / Parent Comments</h3>
            <textarea
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add comments here..."
              aria-label="Teacher or parent comments"
            />
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center border-t border-gray-100 dark:border-gray-700 pt-3 mt-2">
            Click "Export PDF" to print this report as a PDF (A4 portrait), or "Download PDF" to save a real PDF file.
          </p>
        </Card>
      </div>

      {/* Hidden print version */}
      <PrintReport comments={comments} learningAreaId={areaId} />
    </>
  );
}
