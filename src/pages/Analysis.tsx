import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Tabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Select } from '@/components/ui/Select';
import { SLOHeatmap } from '@/components/charts/SLOHeatmap';
import { CompetencyRadarChart } from '@/components/charts/CompetencyRadarChart';
import { CognitiveLevelChart } from '@/components/charts/CognitiveLevelChart';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  getMasteryForStrand,
  getMasteryForSubStrand,
  getMasteryForSLO,
} from '@/utils/scoring';

export function Analysis() {
  const { state } = useApp();
  const { learningAreas, strands, subStrands, slos, exams, results, competencies, settings } = state;
  const { thresholds } = settings;

  const [activeTab, setActiveTab] = useState('strands');
  const [areaId, setAreaId] = useState(learningAreas[0]?.id ?? '');
  const [openStrands, setOpenStrands] = useState<Set<string>>(new Set());
  const [openSubStrands, setOpenSubStrands] = useState<Set<string>>(new Set());

  const areaStrands = strands.filter((s) => s.learningAreaId === areaId).sort((a, b) => a.order - b.order);
  const areaExams = exams.filter((e) => e.learningAreaId === areaId);
  const areaSLOs = slos.filter((slo) =>
    subStrands.some((ss) =>
      areaStrands.some((s) => s.id === ss.strandId) && ss.id === slo.subStrandId
    )
  );

  const toggleStrand = (id: string) => setOpenStrands((prev) => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });

  const toggleSubStrand = (id: string) => setOpenSubStrands((prev) => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Competency Analysis</h1>
        <Select
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          options={learningAreas.map((la) => ({ value: la.id, label: la.name }))}
          aria-label="Select learning area"
        />
      </div>

      <Tabs
        tabs={[
          { id: 'strands', label: 'Strands' },
          { id: 'heatmap', label: 'Heatmap' },
          { id: 'radar', label: 'Radar' },
          { id: 'cognitive', label: 'Cognitive Levels' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'strands' && (
        <div className="space-y-3">
          {areaStrands.map((strand) => {
            const strandMastery = getMasteryForStrand(strand.id, slos, exams, results, thresholds, subStrands);
            const isOpen = openStrands.has(strand.id);
            const strandSubStrands = subStrands.filter((ss) => ss.strandId === strand.id).sort((a, b) => a.order - b.order);
            return (
              <Card key={strand.id} padding={false}>
                <button
                  className="w-full flex items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 rounded-xl"
                  onClick={() => toggleStrand(strand.id)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-700 dark:text-gray-200">{strand.code} — {strand.name}</span>
                      <Badge level={strandMastery.level} size="sm" />
                    </div>
                    <ProgressBar pct={strandMastery.pct} level={strandMastery.level} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    {strandSubStrands.map((ss) => {
                      const ssMastery = getMasteryForSubStrand(ss.id, slos, exams, results, thresholds);
                      const ssOpen = openSubStrands.has(ss.id);
                      const ssLOs = slos.filter((slo) => slo.subStrandId === ss.id);
                      return (
                        <div key={ss.id} className="ml-4 border-l-2 border-gray-200 dark:border-gray-600 pl-4">
                          <button
                            className="w-full flex items-center gap-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            onClick={() => toggleSubStrand(ss.id)}
                            aria-expanded={ssOpen}
                          >
                            {ssOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{ss.code} — {ss.name}</span>
                                <Badge level={ssMastery.level} size="sm" />
                              </div>
                              <ProgressBar pct={ssMastery.pct} level={ssMastery.level} height={6} />
                            </div>
                          </button>

                          {ssOpen && (
                            <div className="mt-2 space-y-2">
                              {ssLOs.map((slo) => {
                                const sloMastery = getMasteryForSLO(slo.id, exams, results, thresholds);
                                return (
                                  <div key={slo.id} className="ml-4 bg-gray-50 dark:bg-gray-750 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400">{slo.code}</span>
                                      <Badge level={sloMastery.level} size="sm" />
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">{slo.description}</p>
                                    <ProgressBar pct={sloMastery.pct} level={sloMastery.level} height={5} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
          {areaStrands.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No strands defined for this learning area.</p>
          )}
        </div>
      )}

      {activeTab === 'heatmap' && (
        <Card>
          <SLOHeatmap slos={areaSLOs} exams={areaExams} results={results} thresholds={thresholds} />
        </Card>
      )}

      {activeTab === 'radar' && (
        <Card header="Core Competency Mastery">
          <CompetencyRadarChart competencies={competencies} exams={exams} results={results} thresholds={thresholds} />
        </Card>
      )}

      {activeTab === 'cognitive' && (
        <Card header="Mastery by Cognitive Level">
          <CognitiveLevelChart exams={areaExams} results={results} thresholds={thresholds} />
        </Card>
      )}
    </div>
  );
}
