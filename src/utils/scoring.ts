import type {
  PerformanceLevel,
  SubLevel,
  LevelThresholds,
  SLO,
  Exam,
  Result,
  MasteryResult,
} from '@/types';

// ─── Level calculation ────────────────────────────────────────────────────────

export function getLevel(pct: number, thresholds: LevelThresholds): PerformanceLevel {
  if (pct >= thresholds.EE) return 'EE';
  if (pct >= thresholds.ME) return 'ME';
  if (pct >= thresholds.AE) return 'AE';
  return 'BE';
}

export function getSubLevel(pct: number): SubLevel {
  if (pct >= 88) return 'EE2';
  if (pct >= 75) return 'EE1';
  if (pct >= 63) return 'ME2';
  if (pct >= 50) return 'ME1';
  if (pct >= 38) return 'AE2';
  if (pct >= 25) return 'AE1';
  if (pct >= 13) return 'BE2';
  return 'BE1';
}

// ─── SLO mastery ─────────────────────────────────────────────────────────────

export function getMasteryForSLO(
  sloId: string,
  exams: Exam[],
  results: Result[],
  thresholds: LevelThresholds,
): MasteryResult {
  let totalScored = 0;
  let totalMax = 0;

  for (const exam of exams) {
    for (const q of exam.questions) {
      if (q.sloId !== sloId) continue;
      const result = results.find((r) => r.questionId === q.id);
      if (result) {
        totalScored += result.marksScored;
        totalMax += q.maxMarks;
      }
    }
  }

  const pct = totalMax === 0 ? 0 : Math.round((totalScored / totalMax) * 100);
  return { pct, level: getLevel(pct, thresholds), subLevel: getSubLevel(pct) };
}

// ─── Sub-strand mastery ───────────────────────────────────────────────────────

export function getMasteryForSubStrand(
  subStrandId: string,
  slos: SLO[],
  exams: Exam[],
  results: Result[],
  thresholds: LevelThresholds,
): MasteryResult {
  const subSLOs = slos.filter((s) => s.subStrandId === subStrandId);
  if (subSLOs.length === 0) return { pct: 0, level: 'BE' };

  const sum = subSLOs.reduce((acc, slo) => {
    return acc + getMasteryForSLO(slo.id, exams, results, thresholds).pct;
  }, 0);

  const pct = Math.round(sum / subSLOs.length);
  return { pct, level: getLevel(pct, thresholds), subLevel: getSubLevel(pct) };
}

// ─── Strand mastery ───────────────────────────────────────────────────────────

export function getMasteryForStrand(
  strandId: string,
  slos: SLO[],
  exams: Exam[],
  results: Result[],
  thresholds: LevelThresholds,
  subStrands: { id: string; strandId: string }[],
): MasteryResult {
  const children = subStrands.filter((ss) => ss.strandId === strandId);
  if (children.length === 0) return { pct: 0, level: 'BE' };

  const sum = children.reduce((acc, ss) => {
    return acc + getMasteryForSubStrand(ss.id, slos, exams, results, thresholds).pct;
  }, 0);

  const pct = Math.round(sum / children.length);
  return { pct, level: getLevel(pct, thresholds), subLevel: getSubLevel(pct) };
}

// ─── Competency mastery ───────────────────────────────────────────────────────

export function getMasteryForCompetency(
  competencyId: string,
  exams: Exam[],
  results: Result[],
  thresholds: LevelThresholds,
): MasteryResult {
  let totalScored = 0;
  let totalMax = 0;

  for (const exam of exams) {
    for (const q of exam.questions) {
      if (!q.competencyIds.includes(competencyId)) continue;
      const result = results.find((r) => r.questionId === q.id);
      if (result) {
        totalScored += result.marksScored;
        totalMax += q.maxMarks;
      }
    }
  }

  const pct = totalMax === 0 ? 0 : Math.round((totalScored / totalMax) * 100);
  return { pct, level: getLevel(pct, thresholds), subLevel: getSubLevel(pct) };
}

// ─── Priority score ───────────────────────────────────────────────────────────

export function getPriorityScore(slo: SLO, masteryPct: number): number {
  return parseFloat(((1 - masteryPct / 100) * slo.weight).toFixed(3));
}

// ─── Top strengths / gaps ─────────────────────────────────────────────────────

export function getTopStrengths(
  n: number,
  slos: SLO[],
  exams: Exam[],
  results: Result[],
  thresholds: LevelThresholds,
): { slo: SLO; mastery: MasteryResult }[] {
  return slos
    .map((slo) => ({ slo, mastery: getMasteryForSLO(slo.id, exams, results, thresholds) }))
    .filter(({ mastery }) => mastery.pct > 0)
    .sort((a, b) => b.mastery.pct - a.mastery.pct)
    .slice(0, n);
}

export function getTopGaps(
  n: number,
  slos: SLO[],
  exams: Exam[],
  results: Result[],
  thresholds: LevelThresholds,
): { slo: SLO; mastery: MasteryResult; priority: number }[] {
  return slos
    .map((slo) => {
      const mastery = getMasteryForSLO(slo.id, exams, results, thresholds);
      return { slo, mastery, priority: getPriorityScore(slo, mastery.pct) };
    })
    .filter(({ mastery }) => mastery.level === 'AE' || mastery.level === 'BE')
    .sort((a, b) => b.priority - a.priority)
    .slice(0, n);
}

// ─── Exam-level summary ───────────────────────────────────────────────────────

export function getExamSummary(
  exam: Exam,
  results: Result[],
  thresholds: LevelThresholds,
) {
  let totalScored = 0;
  let totalMax = 0;

  for (const q of exam.questions) {
    const result = results.find((r) => r.questionId === q.id);
    if (result) {
      totalScored += result.marksScored;
    }
    totalMax += q.maxMarks;
  }

  const pct = totalMax === 0 ? 0 : Math.round((totalScored / totalMax) * 100);
  return {
    totalScored,
    totalMax,
    pct,
    level: getLevel(pct, thresholds),
    subLevel: getSubLevel(pct),
  };
}

// ─── Learning area mastery ────────────────────────────────────────────────────

export function getMasteryForLearningArea(
  learningAreaId: string,
  exams: Exam[],
  results: Result[],
  thresholds: LevelThresholds,
): MasteryResult {
  const areaExams = exams.filter((e) => e.learningAreaId === learningAreaId);
  if (areaExams.length === 0) return { pct: 0, level: 'BE' };

  let totalScored = 0;
  let totalMax = 0;
  for (const exam of areaExams) {
    for (const q of exam.questions) {
      const result = results.find((r) => r.questionId === q.id);
      if (result) totalScored += result.marksScored;
      totalMax += q.maxMarks;
    }
  }

  const pct = totalMax === 0 ? 0 : Math.round((totalScored / totalMax) * 100);
  return { pct, level: getLevel(pct, thresholds), subLevel: getSubLevel(pct) };
}

// ─── Level colour helper ──────────────────────────────────────────────────────

export const LEVEL_COLOURS: Record<PerformanceLevel, string> = {
  EE: '#22c55e',
  ME: '#3b82f6',
  AE: '#f59e0b',
  BE: '#ef4444',
};

export const LEVEL_BG_CLASSES: Record<PerformanceLevel, string> = {
  EE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ME: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  AE: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  BE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export const LEVEL_LABELS: Record<PerformanceLevel, string> = {
  EE: 'Exceeding Expectations',
  ME: 'Meeting Expectations',
  AE: 'Approaching Expectations',
  BE: 'Below Expectations',
};
