import type { ActionPlanItem, PerformanceLevel, SLO } from '@/types';

const ACTIVITY_TEMPLATES: Record<string, string> = {
  'Knowledge gap': 'Review the concept using your textbook and worked examples. Ask your teacher to explain using a different approach.',
  'Application error': 'Work through 5 similar problems step-by-step, checking each stage. Focus on connecting the idea to real situations.',
  'Careless mistake': 'Slow down and re-read each question twice before answering. Check your working after finishing.',
  'Time pressure': 'Practise timed exercises — set a 5-minute timer and attempt 3 similar questions.',
  'Misread question': 'Underline key words in every question before you start. Identify what is being asked before writing anything.',
  default: 'Review this learning outcome with your teacher or a classmate, then try a short practice task to build confidence.',
};

const PRACTICE_TEMPLATES: Record<string, string> = {
  'Knowledge gap': 'Complete the related exercises in your workbook. Use diagrams or concept maps to strengthen understanding.',
  'Application error': 'Create three of your own examples applying this concept to everyday situations.',
  'Careless mistake': 'Redo 3 questions from your exam paper, showing all working clearly.',
  'Time pressure': 'Complete a short timed quiz on this topic with a peer or parent.',
  'Misread question': 'Write 2 of your own questions on this topic, then swap with a classmate to answer.',
  default: 'Complete 5 varied questions on this SLO from a past paper or your workbook.',
};

function nextTargetLevel(current: PerformanceLevel): PerformanceLevel {
  if (current === 'BE') return 'AE';
  if (current === 'AE') return 'ME';
  return 'EE';
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

let itemSequence = 0;

export function generateActionPlanItem(
  slo: SLO,
  _masteryPct: number,
  currentLevel: PerformanceLevel,
  dominantErrorType?: string,
): ActionPlanItem {
  const key = dominantErrorType ?? 'default';
  const activity = ACTIVITY_TEMPLATES[key] ?? ACTIVITY_TEMPLATES.default;
  const practiceTask = PRACTICE_TEMPLATES[key] ?? PRACTICE_TEMPLATES.default;

  itemSequence += 1;

  return {
    id: `ap-${slo.id}-${Date.now()}-${itemSequence}`,
    sloId: slo.id,
    activity,
    practiceTask,
    targetLevel: nextTargetLevel(currentLevel),
    reviewDate: addDays(14),
    completed: false,
  };
}

export function growthMessage(level: PerformanceLevel): string {
  switch (level) {
    case 'BE': return 'Below Expectations — every step forward counts. Let\'s build a solid foundation.';
    case 'AE': return 'Approaching Expectations — you\'re making progress. The next step is ME.';
    case 'ME': return 'Meeting Expectations — great work! Stretch towards Exceeding.';
    case 'EE': return 'Exceeding Expectations — outstanding mastery. Keep it up!';
  }
}
