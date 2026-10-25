import { describe, it, expect } from 'vitest';
import {
  getLevel,
  getSubLevel,
  getMasteryForSLO,
  getMasteryForSubStrand,
  getMasteryForStrand,
  getMasteryForCompetency,
  getPriorityScore,
  getTopGaps,
  getTopStrengths,
  getExamSummary,
  getMasteryForLearningArea,
} from '@/utils/scoring';
import type {
  Exam, ExamType, Question, Result, SLO, SubStrand, Strand, CoreCompetency,
} from '@/types';

const DEFAULT_THRESHOLDS = { EE: 75, ME: 50, AE: 25 };

// ─── Test fixtures ────────────────────────────────────────────────────────────

const LA = 'la-math';
const strand: Strand = { id: 'st-1', learningAreaId: LA, code: 'M.S1', name: 'Number', order: 1 };
const subStrand: SubStrand = { id: 'ss-1', strandId: strand.id, code: 'M.S1.SS1', name: 'Number Ops', order: 1 };

const slo1: SLO = { id: 'slo-1', subStrandId: 'ss-1', code: 'M.S1.SS1.1', description: 'Add', weight: 1 };
const slo2: SLO = { id: 'slo-2', subStrandId: 'ss-1', code: 'M.S1.SS1.2', description: 'Subtract', weight: 2 };

function question(id: string, sloId: string, maxMarks = 10, extras: Partial<Question> = {}): Question {
  return {
    id,
    examId: 'exam-1',
    number: 1,
    maxMarks,
    sloId,
    performanceIndicator: 'Do the thing',
    cognitiveLevel: 'Recall',
    competencyIds: [],
    ...extras,
  };
}

const exam: Exam = {
  id: 'exam-1',
  title: 'Maths Mid-term',
  type: 'Mid-term' as ExamType,
  term: 1,
  date: '2025-03-15',
  learningAreaId: LA,
  questions: [
    question('q1', 'slo-1', 10, { cognitiveLevel: 'Recall', competencyIds: ['cc1'] }),
    question('q2', 'slo-2', 10, { cognitiveLevel: 'Application', competencyIds: ['cc1', 'cc2'] }),
  ],
};

// ─── Level boundaries (REQ-P1: EE ≥75, ME 50–74, AE 25–49, BE 0–24) ──────────

describe('getLevel boundaries', () => {
  const cases: [number, string][] = [
    [0, 'BE'],
    [1, 'BE'],
    [24, 'BE'],
    [25, 'AE'],
    [26, 'AE'],
    [49, 'AE'],
    [50, 'ME'],
    [51, 'ME'],
    [74, 'ME'],
    [75, 'EE'],
    [99, 'EE'],
    [100, 'EE'],
  ];
  for (const [pct, expected] of cases) {
    it(`maps ${pct}% to ${expected}`, () => {
      expect(getLevel(pct, DEFAULT_THRESHOLDS)).toBe(expected);
    });
  }

  it('respects custom thresholds (REQ-P2)', () => {
    expect(getLevel(80, { EE: 85, ME: 40, AE: 20 })).toBe('ME');
    expect(getLevel(85, { EE: 85, ME: 40, AE: 20 })).toBe('EE');
  });
});

describe('getSubLevel boundaries (REQ-P3)', () => {
  const cases: [number, string][] = [
    [0, 'BE1'],
    [12, 'BE1'],
    [13, 'BE2'],
    [24, 'BE2'],
    [25, 'AE1'],
    [37, 'AE1'],
    [38, 'AE2'],
    [49, 'AE2'],
    [50, 'ME1'],
    [62, 'ME1'],
    [63, 'ME2'],
    [74, 'ME2'],
    [75, 'EE1'],
    [87, 'EE1'],
    [88, 'EE2'],
    [100, 'EE2'],
  ];
  for (const [pct, expected] of cases) {
    it(`maps ${pct}% to ${expected}`, () => {
      expect(getSubLevel(pct)).toBe(expected);
    });
  }
});

// ─── Mastery aggregation ─────────────────────────────────────────────────────

describe('mastery aggregation', () => {
  const results: Result[] = [
    { id: 'r1', examId: 'exam-1', questionId: 'q1', marksScored: 10 }, // slo-1 → 100%
    { id: 'r2', examId: 'exam-1', questionId: 'q2', marksScored: 5 },  // slo-2 → 50%
  ];

  it('aggregates per SLO', () => {
    expect(getMasteryForSLO('slo-1', [exam], results, DEFAULT_THRESHOLDS).pct).toBe(100);
    expect(getMasteryForSLO('slo-2', [exam], results, DEFAULT_THRESHOLDS).pct).toBe(50);
    expect(getMasteryForSLO('slo-2', [exam], [], DEFAULT_THRESHOLDS).pct).toBe(0);
  });

  it('aggregates per sub-strand as the mean of its SLOs', () => {
    const m = getMasteryForSubStrand('ss-1', [slo1, slo2], [exam], results, DEFAULT_THRESHOLDS);
    expect(m.pct).toBe(75); // (100 + 50) / 2
    expect(m.level).toBe('EE');
  });

  it('aggregates per strand as the mean of sub-strand mastery', () => {
    const m = getMasteryForStrand('st-1', [slo1, slo2], [exam], results, DEFAULT_THRESHOLDS, [subStrand]);
    expect(m.pct).toBe(75);
  });

  it('returns 0/BE with no data (never NaN)', () => {
    const ss = getMasteryForSubStrand('ss-none', [slo1, slo2], [exam], results, DEFAULT_THRESHOLDS);
    expect(ss.pct).toBe(0);
    expect(ss.level).toBe('BE');
    const st = getMasteryForStrand('st-none', [slo1], [exam], results, DEFAULT_THRESHOLDS, [subStrand]);
    expect(st.pct).toBe(0);
    expect(st.level).toBe('BE');
  });

  it('aggregates per competency with weighted marks', () => {
    const competency: CoreCompetency = { id: 'cc1', name: 'Critical Thinking', shortName: 'Critical', colour: '#000' };
    // q1: 10/10, q2: 5/10 → competency totals 15/20 = 75%
    const m = getMasteryForCompetency('cc1', [exam], results, DEFAULT_THRESHOLDS);
    expect(m.pct).toBe(75);
    void competency;
  });

  it('aggregates per learning area over its exams', () => {
    const m = getMasteryForLearningArea(LA, [exam], results, DEFAULT_THRESHOLDS);
    expect(m.pct).toBe(75); // 15/20
    expect(getMasteryForLearningArea('la-none', [exam], results, DEFAULT_THRESHOLDS).pct).toBe(0);
  });
});

describe('exam summary', () => {
  it('sums scored/max and handles division by zero', () => {
    const results: Result[] = [{ id: 'r1', examId: 'exam-1', questionId: 'q1', marksScored: 10 }];
    const s = getExamSummary(exam, results, DEFAULT_THRESHOLDS);
    expect(s.totalScored).toBe(10);
    expect(s.totalMax).toBe(20);
    expect(s.pct).toBe(50);

    const emptyExam: Exam = { ...exam, questions: [] };
    const se = getExamSummary(emptyExam, [], DEFAULT_THRESHOLDS);
    expect(se.pct).toBe(0);
    expect(se.level).toBe('BE');
  });
});

// ─── Priority & ranking (REQ-G2/G3) ──────────────────────────────────────────

describe('priority score', () => {
  it('is (1 − mastery) × weight and honours SLO weight', () => {
    expect(getPriorityScore({ ...slo2, weight: 2 }, 50)).toBe(1);
    expect(getPriorityScore({ ...slo1, weight: 1 }, 50)).toBe(0.5);
    expect(getPriorityScore(slo1, 100)).toBe(0);
    expect(getPriorityScore(slo1, 0)).toBe(1);
  });
});

describe('gap and strength ranking', () => {
  const exams = [exam];
  const results: Result[] = [
    { id: 'r1', examId: 'exam-1', questionId: 'q1', marksScored: 10 },  // slo-1: EE (excluded from gaps)
    { id: 'r2', examId: 'exam-1', questionId: 'q2', marksScored: 2 },   // slo-2: BE, weight 2 → priority 1.6
  ];

  it('lists only AE/BE SLOs as gaps, ranked by priority', () => {
    const gaps = getTopGaps(3, [slo1, slo2], exams, results, DEFAULT_THRESHOLDS);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].slo.id).toBe('slo-2');
    expect(gaps[0].priority).toBeCloseTo(1.6);
    expect(gaps[0].mastery.level).toBe('BE');
  });

  it('lists strengths ranked by mastery', () => {
    const strengths = getTopStrengths(3, [slo1, slo2], exams, results, DEFAULT_THRESHOLDS);
    expect(strengths[0].slo.id).toBe('slo-1');
    expect(strengths[0].mastery.pct).toBe(100);
  });

  it('returns empty arrays with no data (friendly empty state)', () => {
    expect(getTopGaps(3, [], [], [], DEFAULT_THRESHOLDS)).toEqual([]);
    expect(getTopStrengths(3, [], [], [], DEFAULT_THRESHOLDS)).toEqual([]);
  });
});

// ─── Progress comparison logic (REQ-PC1) ────────────────────────────────────

describe('exam comparison per SLO', () => {
  const examA = {
    ...exam,
    id: 'exam-a',
    questions: [question('qa1', 'slo-1', 10), question('qa2', 'slo-2', 10)],
  };
  const examB = {
    ...exam,
    id: 'exam-b',
    questions: [question('qb1', 'slo-1', 10), question('qb2', 'slo-2', 10)],
  };
  const results: Result[] = [
    { id: 'ra1', examId: 'exam-a', questionId: 'qa1', marksScored: 4 },  // slo-1 A: 40%
    { id: 'ra2', examId: 'exam-a', questionId: 'qa2', marksScored: 8 },  // slo-2 A: 80%
    { id: 'rb1', examId: 'exam-b', questionId: 'qb1', marksScored: 7 },  // slo-1 B: 70% → improved
    { id: 'rb2', examId: 'exam-b', questionId: 'qb2', marksScored: 8 },  // slo-2 B: 80% → same
  ];

  it('computes improved, same and declined deltas per SLO', () => {
    const m1A = getMasteryForSLO('slo-1', [examA], results, DEFAULT_THRESHOLDS);
    const m1B = getMasteryForSLO('slo-1', [examB], results, DEFAULT_THRESHOLDS);
    expect(m1B.pct - m1A.pct).toBe(30); // improved

    const m2A = getMasteryForSLO('slo-2', [examA], results, DEFAULT_THRESHOLDS);
    const m2B = getMasteryForSLO('slo-2', [examB], results, DEFAULT_THRESHOLDS);
    expect(m2B.pct - m2A.pct).toBe(0); // same

    // A declined case
    const results2: Result[] = [
      { id: 'rb1', examId: 'exam-b', questionId: 'qb1', marksScored: 1 },
    ];
    const d1 = getMasteryForSLO('slo-1', [examB], results2, DEFAULT_THRESHOLDS);
    expect(d1.pct - m1A.pct).toBe(-30); // declined
    void exam;
  });
});
