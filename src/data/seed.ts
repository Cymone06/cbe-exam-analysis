import type {
  AppState,
  LearnerProfile,
  LearningArea,
  Strand,
  SubStrand,
  SLO,
  CoreCompetency,
  Exam,
  Question,
  Result,
  AppSettings,
} from '@/types';

// ─── IDs ─────────────────────────────────────────────────────────────────────

const LEARNER_ID = 'seed-learner-1';

// Learning areas
const LA_MATH = 'la-math';
const LA_ENG = 'la-eng';
const LA_SCI = 'la-sci';

// Strands — Math
const S_M1 = 's-m1'; // Number
const S_M2 = 's-m2'; // Algebra
const S_M3 = 's-m3'; // Geometry & Measurement

// Strands — English
const S_E1 = 's-e1'; // Reading
const S_E2 = 's-e2'; // Writing
const S_E3 = 's-e3'; // Oral Language

// Strands — Science
const S_SC1 = 's-sc1'; // Life Science
const S_SC2 = 's-sc2'; // Physical Science

// Sub-strands — Math
const SS_M1_1 = 'ss-m1-1'; // Number operations
const SS_M1_2 = 'ss-m1-2'; // Fractions & Decimals
const SS_M2_1 = 'ss-m2-1'; // Patterns
const SS_M3_1 = 'ss-m3-1'; // Shapes
const SS_M3_2 = 'ss-m3-2'; // Measurement

// Sub-strands — English
const SS_E1_1 = 'ss-e1-1'; // Comprehension
const SS_E2_1 = 'ss-e2-1'; // Composition
const SS_E3_1 = 'ss-e3-1'; // Speaking & Listening

// Sub-strands — Science
const SS_SC1_1 = 'ss-sc1-1'; // Living things
const SS_SC2_1 = 'ss-sc2-1'; // Matter

// SLOs — Math
const SLO_M1 = 'slo-m1'; const SLO_M2 = 'slo-m2'; const SLO_M3 = 'slo-m3';
const SLO_M4 = 'slo-m4'; const SLO_M5 = 'slo-m5';

// SLOs — English
const SLO_E1 = 'slo-e1'; const SLO_E2 = 'slo-e2'; const SLO_E3 = 'slo-e3';

// SLOs — Science
const SLO_SC1 = 'slo-sc1'; const SLO_SC2 = 'slo-sc2';

// Competencies
const CC1 = 'cc1'; const CC2 = 'cc2'; const CC3 = 'cc3'; const CC4 = 'cc4';
const CC5 = 'cc5'; const CC6 = 'cc6'; const CC7 = 'cc7';

// Exams
const EXAM_MATH_T1 = 'exam-math-t1';
const EXAM_ENG_T1 = 'exam-eng-t1';

// ─── Profile ─────────────────────────────────────────────────────────────────

export const seedLearner: LearnerProfile = {
  id: LEARNER_ID,
  name: 'Ama Mensah',
  grade: 6,
  school: 'Accra Model Primary School',
  year: '2025',
};

// ─── Learning Areas ───────────────────────────────────────────────────────────

export const seedLearningAreas: LearningArea[] = [
  { id: LA_MATH, name: 'Mathematics', colour: '#6366f1' },
  { id: LA_ENG,  name: 'English Language', colour: '#ec4899' },
  { id: LA_SCI,  name: 'Integrated Science', colour: '#14b8a6' },
];

// ─── Strands ──────────────────────────────────────────────────────────────────

export const seedStrands: Strand[] = [
  { id: S_M1, learningAreaId: LA_MATH, code: 'M.S1', name: 'Number',               order: 1 },
  { id: S_M2, learningAreaId: LA_MATH, code: 'M.S2', name: 'Algebra',              order: 2 },
  { id: S_M3, learningAreaId: LA_MATH, code: 'M.S3', name: 'Geometry & Measurement', order: 3 },
  { id: S_E1, learningAreaId: LA_ENG,  code: 'E.S1', name: 'Reading',              order: 1 },
  { id: S_E2, learningAreaId: LA_ENG,  code: 'E.S2', name: 'Writing',              order: 2 },
  { id: S_E3, learningAreaId: LA_ENG,  code: 'E.S3', name: 'Oral Language',        order: 3 },
  { id: S_SC1, learningAreaId: LA_SCI, code: 'SC.S1', name: 'Life Science',        order: 1 },
  { id: S_SC2, learningAreaId: LA_SCI, code: 'SC.S2', name: 'Physical Science',    order: 2 },
];

// ─── Sub-strands ──────────────────────────────────────────────────────────────

export const seedSubStrands: SubStrand[] = [
  { id: SS_M1_1, strandId: S_M1, code: 'M.S1.SS1', name: 'Number Operations',    order: 1 },
  { id: SS_M1_2, strandId: S_M1, code: 'M.S1.SS2', name: 'Fractions & Decimals', order: 2 },
  { id: SS_M2_1, strandId: S_M2, code: 'M.S2.SS1', name: 'Patterns & Relations', order: 1 },
  { id: SS_M3_1, strandId: S_M3, code: 'M.S3.SS1', name: '2D & 3D Shapes',       order: 1 },
  { id: SS_M3_2, strandId: S_M3, code: 'M.S3.SS2', name: 'Measurement',          order: 2 },
  { id: SS_E1_1, strandId: S_E1, code: 'E.S1.SS1', name: 'Comprehension',        order: 1 },
  { id: SS_E2_1, strandId: S_E2, code: 'E.S2.SS1', name: 'Composition',          order: 1 },
  { id: SS_E3_1, strandId: S_E3, code: 'E.S3.SS1', name: 'Speaking & Listening', order: 1 },
  { id: SS_SC1_1, strandId: S_SC1, code: 'SC.S1.SS1', name: 'Living Things',     order: 1 },
  { id: SS_SC2_1, strandId: S_SC2, code: 'SC.S2.SS1', name: 'Matter & Materials', order: 1 },
];

// ─── SLOs ─────────────────────────────────────────────────────────────────────

export const seedSLOs: SLO[] = [
  { id: SLO_M1, subStrandId: SS_M1_1, code: 'M.S1.SS1.1', description: 'Add and subtract whole numbers up to 1,000,000', weight: 1 },
  { id: SLO_M2, subStrandId: SS_M1_2, code: 'M.S1.SS2.1', description: 'Compare and order fractions and decimals', weight: 1 },
  { id: SLO_M3, subStrandId: SS_M2_1, code: 'M.S2.SS1.1', description: 'Identify, describe and extend number patterns', weight: 1 },
  { id: SLO_M4, subStrandId: SS_M3_1, code: 'M.S3.SS1.1', description: 'Classify 2D shapes by properties', weight: 1 },
  { id: SLO_M5, subStrandId: SS_M3_2, code: 'M.S3.SS2.1', description: 'Calculate perimeter and area of rectangles', weight: 1 },
  { id: SLO_E1, subStrandId: SS_E1_1, code: 'E.S1.SS1.1', description: 'Retrieve explicit information from a text', weight: 1 },
  { id: SLO_E2, subStrandId: SS_E2_1, code: 'E.S2.SS1.1', description: 'Write a structured paragraph with a topic sentence', weight: 1 },
  { id: SLO_E3, subStrandId: SS_E3_1, code: 'E.S3.SS1.1', description: 'Participate in group discussions using appropriate register', weight: 1 },
  { id: SLO_SC1, subStrandId: SS_SC1_1, code: 'SC.S1.SS1.1', description: 'Explain the characteristics of living and non-living things', weight: 1 },
  { id: SLO_SC2, subStrandId: SS_SC2_1, code: 'SC.S2.SS1.1', description: 'Investigate properties of common materials', weight: 1 },
];

// ─── Core Competencies ────────────────────────────────────────────────────────

export const seedCompetencies: CoreCompetency[] = [
  { id: CC1, name: 'Critical Thinking & Problem Solving', shortName: 'Critical Thinking', colour: '#6366f1' },
  { id: CC2, name: 'Creativity & Innovation',             shortName: 'Creativity',         colour: '#ec4899' },
  { id: CC3, name: 'Communication & Collaboration',       shortName: 'Communication',       colour: '#14b8a6' },
  { id: CC4, name: 'Digital Literacy',                    shortName: 'Digital Literacy',    colour: '#f59e0b' },
  { id: CC5, name: 'Personal Development & Leadership',   shortName: 'Leadership',          colour: '#8b5cf6' },
  { id: CC6, name: 'Global Citizenship',                  shortName: 'Global Citizenship',  colour: '#22c55e' },
  { id: CC7, name: 'Cultural Identity & Expression',      shortName: 'Cultural Identity',   colour: '#ef4444' },
];

// ─── Exams ────────────────────────────────────────────────────────────────────

const mathQuestions: Question[] = [
  { id: 'q-m1', examId: EXAM_MATH_T1, number: 1, maxMarks: 10, sloId: SLO_M1, performanceIndicator: 'Add 6-digit numbers correctly', cognitiveLevel: 'Recall', competencyIds: [CC1] },
  { id: 'q-m2', examId: EXAM_MATH_T1, number: 2, maxMarks: 10, sloId: SLO_M2, performanceIndicator: 'Order fractions on a number line', cognitiveLevel: 'Understanding', competencyIds: [CC1] },
  { id: 'q-m3', examId: EXAM_MATH_T1, number: 3, maxMarks: 10, sloId: SLO_M3, performanceIndicator: 'Extend a pattern and state the rule', cognitiveLevel: 'Application', competencyIds: [CC1, CC2] },
  { id: 'q-m4', examId: EXAM_MATH_T1, number: 4, maxMarks: 10, sloId: SLO_M4, performanceIndicator: 'Name and classify triangles by sides', cognitiveLevel: 'Understanding', competencyIds: [CC1] },
  { id: 'q-m5', examId: EXAM_MATH_T1, number: 5, maxMarks: 10, sloId: SLO_M5, performanceIndicator: 'Calculate area of a rectangle given dimensions', cognitiveLevel: 'Application', competencyIds: [CC1, CC3] },
];

const engQuestions: Question[] = [
  { id: 'q-e1', examId: EXAM_ENG_T1, number: 1, maxMarks: 15, sloId: SLO_E1, performanceIndicator: 'Answer literal comprehension questions', cognitiveLevel: 'Recall', competencyIds: [CC3] },
  { id: 'q-e2', examId: EXAM_ENG_T1, number: 2, maxMarks: 15, sloId: SLO_E1, performanceIndicator: 'Infer meaning from context clues', cognitiveLevel: 'Higher-order', competencyIds: [CC1, CC3] },
  { id: 'q-e3', examId: EXAM_ENG_T1, number: 3, maxMarks: 20, sloId: SLO_E2, performanceIndicator: 'Write a 5-sentence paragraph on a given topic', cognitiveLevel: 'Application', competencyIds: [CC2, CC3] },
];

export const seedExams: Exam[] = [
  {
    id: EXAM_MATH_T1,
    title: 'Mathematics Mid-term — Term 1',
    type: 'Mid-term',
    term: 1,
    date: '2025-03-15',
    learningAreaId: LA_MATH,
    questions: mathQuestions,
  },
  {
    id: EXAM_ENG_T1,
    title: 'English Language CAT — Term 1',
    type: 'CAT',
    term: 1,
    date: '2025-03-22',
    learningAreaId: LA_ENG,
    questions: engQuestions,
  },
];

// ─── Results ──────────────────────────────────────────────────────────────────

export const seedResults: Result[] = [
  // Math exam — varied performance
  { id: 'r-m1', examId: EXAM_MATH_T1, questionId: 'q-m1', marksScored: 9 },
  { id: 'r-m2', examId: EXAM_MATH_T1, questionId: 'q-m2', marksScored: 6, errorType: 'Application error', note: 'Confused proper and improper fractions' },
  { id: 'r-m3', examId: EXAM_MATH_T1, questionId: 'q-m3', marksScored: 4, errorType: 'Knowledge gap', note: 'Could not identify the rule' },
  { id: 'r-m4', examId: EXAM_MATH_T1, questionId: 'q-m4', marksScored: 8 },
  { id: 'r-m5', examId: EXAM_MATH_T1, questionId: 'q-m5', marksScored: 3, errorType: 'Knowledge gap', note: 'Confused area with perimeter' },
  // English exam
  { id: 'r-e1', examId: EXAM_ENG_T1, questionId: 'q-e1', marksScored: 13 },
  { id: 'r-e2', examId: EXAM_ENG_T1, questionId: 'q-e2', marksScored: 9, errorType: 'Application error' },
  { id: 'r-e3', examId: EXAM_ENG_T1, questionId: 'q-e3', marksScored: 14 },
];

// ─── Settings ─────────────────────────────────────────────────────────────────

export const defaultSettings: AppSettings = {
  subLevelEnabled: false,
  thresholds: { EE: 75, ME: 50, AE: 25 },
  theme: 'light',
};

// ─── Full seed state ──────────────────────────────────────────────────────────

export const seedState: AppState = {
  learner: seedLearner,
  learners: [seedLearner],
  activeLearnerId: LEARNER_ID,
  learningAreas: seedLearningAreas,
  strands: seedStrands,
  subStrands: seedSubStrands,
  slos: seedSLOs,
  competencies: seedCompetencies,
  exams: seedExams,
  results: seedResults,
  actionPlan: [],
  settings: defaultSettings,
  seedDismissed: false,
};
