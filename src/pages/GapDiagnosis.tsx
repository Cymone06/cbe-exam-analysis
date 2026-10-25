import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { getMasteryForSLO, getPriorityScore } from '@/utils/scoring';
import { generateActionPlanItem } from '@/utils/actionPlan';
import type { ErrorType, SLO, LearningArea, Strand, SubStrand, MasteryResult } from '@/types';
import { AlertTriangle, Plus, ArrowUpDown } from 'lucide-react';

type SortKey = 'priority' | 'mastery' | 'area';
type ViewMode = 'grouped' | 'flat';

interface GapItem {
  slo: SLO;
  mastery: MasteryResult;
  priority: number;
  dominantError?: ErrorType;
  la?: LearningArea;
  strand?: Strand;
  subStrand?: SubStrand;
}

export function GapDiagnosis() {
  const { state, dispatch } = useApp();
  const { slos, exams, results, learningAreas, subStrands, strands, settings, actionPlan } = state;
  const { thresholds } = settings;

  const [areaFilter, setAreaFilter] = useState('');
  const [errorFilter, setErrorFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');

  const ERROR_TYPES: ErrorType[] = [
    'Knowledge gap', 'Application error', 'Careless mistake', 'Time pressure', 'Misread question',
  ];

  // Build gap items
  const gapItems = slos
    .map((slo) => {
      const mastery = getMasteryForSLO(slo.id, exams, results, thresholds);
      const priority = getPriorityScore(slo, mastery.pct);

      // Dominant error type from results for this SLO's questions
      const sloQuestions = exams.flatMap((e) => e.questions.filter((q) => q.sloId === slo.id));
      const sloResults = results.filter((r) => sloQuestions.some((q) => q.id === r.questionId) && r.errorType);
      const errorCounts: Record<string, number> = {};
      for (const r of sloResults) {
        if (r.errorType) errorCounts[r.errorType] = (errorCounts[r.errorType] ?? 0) + 1;
      }
      const dominantError = Object.entries(errorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as ErrorType | undefined;

      // Learning area
      const subStrand = subStrands.find((ss) => ss.id === slo.subStrandId);
      const strand = strands.find((s) => s.id === subStrand?.strandId);
      const la = learningAreas.find((la) => la.id === strand?.learningAreaId);

      return { slo, mastery, priority, dominantError, la, strand, subStrand };
    })
    .filter((item) => item.mastery.level === 'AE' || item.mastery.level === 'BE')
    .filter((item) => !areaFilter || item.la?.id === areaFilter)
    .filter((item) => !errorFilter || item.dominantError === errorFilter)
    .sort((a, b) => {
      if (sortKey === 'priority') return b.priority - a.priority;
      if (sortKey === 'mastery') return a.mastery.pct - b.mastery.pct;
      return (a.la?.name ?? '').localeCompare(b.la?.name ?? '');
    });

  const inPlan = new Set(actionPlan.map((i) => i.sloId));

  // ─── Grouped view: error type → sub-strand (REQ-G1) ─────────────────────────
  const groupedView = viewMode === 'grouped' && sortKey === 'priority';
  const errorGroups: { error: string; clusters: { subStrand: string; items: typeof gapItems }[] }[] = [];
  if (groupedView && gapItems.length > 0) {
    const byError = new Map<string, typeof gapItems>();
    for (const item of gapItems) {
      const key = item.dominantError ?? 'Unclassified';
      if (!byError.has(key)) byError.set(key, []);
      byError.get(key)!.push(item);
    }
    for (const [error, items] of byError) {
      const bySubStrand = new Map<string, typeof gapItems>();
      for (const item of items) {
        const key = `${item.subStrand?.code} — ${item.subStrand?.name}`;
        if (!bySubStrand.has(key)) bySubStrand.set(key, []);
        bySubStrand.get(key)!.push(item);
      }
      errorGroups.push({
        error,
        clusters: Array.from(bySubStrand, ([subStrand, clusterItems]) => ({ subStrand, items: clusterItems })),
      });
    }
  }

  const addToActionPlan = (slo: SLO, dominantError?: ErrorType) => {
    const mastery = getMasteryForSLO(slo.id, exams, results, thresholds);
    const item = generateActionPlanItem(slo, mastery.pct, mastery.level, dominantError);
    dispatch({ type: 'ADD_ACTION_ITEM', payload: item });
  };

  const addAllToActionPlan = () => {
    for (const { slo, dominantError } of gapItems) {
      if (!inPlan.has(slo.id)) addToActionPlan(slo, dominantError);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Gap Diagnosis</h1>
        {gapItems.length > 0 && (
          <Button size="sm" onClick={addAllToActionPlan}>
            <Plus size={15} /> Add All to Action Plan
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <Select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            options={learningAreas.map((la) => ({ value: la.id, label: la.name }))}
            placeholder="All Learning Areas"
          />
        </div>
        <div className="w-48">
          <Select
            value={errorFilter}
            onChange={(e) => setErrorFilter(e.target.value)}
            options={ERROR_TYPES.map((et) => ({ value: et, label: et }))}
            placeholder="All Error Types"
          />
        </div>
        <div className="w-40">
          <Select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            options={[
              { value: 'priority', label: 'Sort: Priority' },
              { value: 'mastery', label: 'Sort: Mastery' },
              { value: 'area', label: 'Sort: Area' },
            ]}
          />
        </div>
        <div className="w-40">
          <Select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as ViewMode)}
            options={[
              { value: 'grouped', label: 'Group: Error type' },
              { value: 'flat', label: 'Flat ranked list' },
            ]}
            aria-label="View mode"
          />
        </div>
      </div>

      {gapItems.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <AlertTriangle className="mx-auto text-gray-300 dark:text-gray-600" size={40} />
            <p className="mt-3 text-gray-500 dark:text-gray-400">
              {slos.length === 0 ? 'No SLOs defined yet.' : 'No gaps detected — well done!'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {gapItems.length} SLO{gapItems.length !== 1 ? 's' : ''} need attention
          </p>

          {groupedView ? (
            // Grouped by dominant error type, then sub-strand (REQ-G1)
            errorGroups.map(({ error, clusters }) => (
              <section key={error} aria-label={`Gaps with dominant error type: ${error}`}>
                <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mt-4 mb-2">
                  {error}
                </h2>
                {clusters.map(({ subStrand, items }) => (
                  <div key={subStrand} className="mb-3">
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1 ml-1">
                      {subStrand}
                    </p>
                    <div className="space-y-2">
                      {items.map((item) => <GapCard key={item.slo.id} item={item} inPlan={inPlan} onAdd={addToActionPlan} />)}
                    </div>
                  </div>
                ))}
              </section>
            ))
          ) : (
            gapItems.map((item) => <GapCard key={item.slo.id} item={item} inPlan={inPlan} onAdd={addToActionPlan} />)
          )}
        </div>
      )}
    </div>
  );
}

function GapCard({
  item, inPlan, onAdd,
}: {
  item: GapItem;
  inPlan: Set<string>;
  onAdd: (slo: SLO, dominantError?: ErrorType) => void;
}) {
  const { slo, mastery, priority, dominantError, la, strand, subStrand } = item;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-sm text-indigo-600 dark:text-indigo-400">{slo.code}</span>
            <Badge level={mastery.level} size="sm" />
            <span className="text-xs text-gray-400 dark:text-gray-500">
              <ArrowUpDown size={10} className="inline mr-0.5" />
              Priority: {priority.toFixed(2)}
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{slo.description}</p>
          <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            {la && <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{la.name}</span>}
            {strand && <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{strand.name}</span>}
            {subStrand && <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">{subStrand.code}</span>}
            {dominantError && (
              <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                {dominantError}
              </span>
            )}
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
            {mastery.level === 'BE'
              ? `${mastery.pct}% — Building foundations: every step forward counts.`
              : `${mastery.pct}% — Approaching expectations: next step is ME.`}
          </p>
        </div>
        <Button
          variant={inPlan.has(slo.id) ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => onAdd(slo, dominantError)}
          disabled={inPlan.has(slo.id)}
        >
          {inPlan.has(slo.id) ? '✓ In Plan' : <><Plus size={13} /> Plan</>}
        </Button>
      </div>
    </Card>
  );
}
