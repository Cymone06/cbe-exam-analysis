import { describe, it, expect, vi } from 'vitest';
import { generateActionPlanItem, growthMessage } from '@/utils/actionPlan';
import type { SLO, PerformanceLevel } from '@/types';

const slo: SLO = { id: 'slo-1', subStrandId: 'ss-1', code: 'M.S1.SS1.1', description: 'Add numbers', weight: 1 };

describe('generateActionPlanItem (REQ-AP1)', () => {
  it('generates an item targeting the next level with a +14 day review date', () => {
    const item = generateActionPlanItem(slo, 20, 'BE', 'Knowledge gap');
    expect(item.sloId).toBe('slo-1');
    expect(item.targetLevel).toBe('AE');
    expect(item.completed).toBe(false);
    expect(item.activity).toContain('Review the concept');
    expect(item.practiceTask).toContain('workbook');

    const expected = new Date();
    expected.setDate(expected.getDate() + 14);
    expect(item.reviewDate).toBe(expected.toISOString().slice(0, 10));
  });

  it('targets ME for AE learners and EE beyond', () => {
    expect(generateActionPlanItem(slo, 40, 'AE').targetLevel).toBe('ME');
    expect(generateActionPlanItem(slo, 80, 'ME').targetLevel).toBe('EE');
    expect(generateActionPlanItem(slo, 100, 'EE').targetLevel).toBe('EE');
  });

  it('matches templates per error type and falls back to default copy', () => {
    const timed = generateActionPlanItem(slo, 30, 'AE', 'Time pressure');
    expect(timed.activity).toContain('timed exercises');

    const unknown = generateActionPlanItem(slo, 30, 'AE', 'Something new');
    expect(unknown.activity).toBeTruthy();
    expect(unknown.practiceTask).toBeTruthy();
  });

  it('creates unique ids for repeated items', () => {
    const a = generateActionPlanItem(slo, 30, 'AE');
    const b = generateActionPlanItem(slo, 30, 'AE');
    expect(a.id).not.toBe(b.id);
  });
});

describe('growthMessage (REQ-NF5)', () => {
  const levels: PerformanceLevel[] = ['BE', 'AE', 'ME', 'EE'];
  for (const level of levels) {
    it(`encourages at ${level}`, () => {
      const msg = growthMessage(level);
      expect(msg).toBeTruthy();
      expect(msg.length).toBeGreaterThan(10);
    });
  }
  it('never contains shame-based wording', () => {
    const all = levels.map(growthMessage).join(' ');
    for (const bad of ['shame', 'failure', 'stupid', 'lazy', 'awful', 'terrible']) {
      expect(all.toLowerCase()).not.toContain(bad);
    }
    void vi;
  });
});
