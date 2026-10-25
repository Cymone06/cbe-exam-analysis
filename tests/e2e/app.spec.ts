/**
 * Real-browser E2E journey (complements the jsdom journey test):
 * seeded app → navigate all pages → create exam → enter marks →
 * comparison with term filter → report → PDF download.
 */
import { test, expect, type Page } from '@playwright/test';

const nav = (page: Page, name: string) =>
  page.getByRole('link', { name: new RegExp(`^${name}$`) }).first();

test('full learner journey in a real browser', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await page.waitForSelector('h1');

  // ── 1. Seeded dashboard renders ────────────────────────────────────────────
  await expect(page.getByText('sample data')).toBeVisible();
  await expect(page.getByText('Top Strengths')).toBeVisible();

  // ── 2. Navigate every main page without errors ─────────────────────────────
  const routes: [string, RegExp][] = [
    ['Exams', /Exams$/],
    ['Analysis', /Competency Analysis$/],
    ['Gaps', /Gap Diagnosis$/],
    ['Action Plan', /Action Plan$/],
    ['Compare', /Progress Comparison$/],
    ['Report', /CBE Learner Report$/],
    ['Settings', /Settings$/],
  ];
  for (const [name, heading] of routes) {
    await nav(page, name).click();
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({
      timeout: 8000,
    });
  }

  // ── 3. Create an exam on the seeded Mathematics curriculum ─────────────────
  await nav(page, 'Exams').click();
  await page.getByRole('link', { name: /New Exam/i }).first().click();
  await page.getByLabel('Exam Title *').fill('Playwright QA Exam');
  await page.getByLabel('Learning Area *').selectOption({ label: 'Mathematics' });
  await page.getByLabel('Type').selectOption('Mid-term');
  await page.getByRole('button', { name: /Next: Questions/i }).click();

  await page.getByLabel('Search SLO by code or description').fill('Add and subtract');
  await page
    .getByRole('button', { name: /Add and subtract whole numbers up to 1,000,000/ })
    .first()
    .click();
  await page.getByRole('button', { name: /Save Exam/i }).click();

  await expect(page.getByText('Playwright QA Exam')).toBeVisible();
  await expect(page.getByText('No results')).toBeVisible();

  // ── 4. Enter marks (scoped to the QA exam card); over-max blocked ──────────
  const qaCard = page.locator('div.rounded-xl').filter({ hasText: 'Playwright QA Exam' });
  await qaCard.getByRole('link', { name: 'Enter results' }).click();

  const marks = page.getByLabel('Marks for question 1');
  await marks.fill('15');
  await expect(page.getByText(/Marks cannot exceed/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Save Results/i })).toBeDisabled();
  await marks.fill('8');
  await page.getByRole('button', { name: /Save Results/i }).click();

  // Back on the exam list, the QA exam card shows its live summary
  await expect(qaCard.getByText('80%')).toBeVisible();

  // ── 5. Progress comparison incl. the new term filter ──────────────────────
  await nav(page, 'Compare').click();
  await expect(page.getByRole('heading', { name: /Progress Comparison$/ })).toBeVisible();
  // Term filter exists and can restrict the exam list
  await page.getByLabel('Term', { exact: true }).selectOption({ label: 'Term 1' });
  await page.getByLabel('Term', { exact: true }).selectOption({ label: 'All terms' });

  // Compare the seeded earlier exam with our new QA exam
  await page.getByLabel('Exam A (earlier)').selectOption({ index: 1 });
  const examBSelect = page.getByLabel('Exam B (later)');
  const qaLabel = (await examBSelect.locator('option', { hasText: 'Playwright QA Exam' }).textContent())?.trim();
  await examBSelect.selectOption({ label: qaLabel });
  await expect(page.getByText(/percentage points/)).toBeVisible();
  await expect(page.getByText('M.S1.SS1.1')).toBeVisible();

  // ── 6. Report renders and "Download PDF" saves a real PDF file ────────────
  await nav(page, 'Report').click();
  await expect(page.getByRole('heading', { name: /CBE Learner Report$/ })).toBeVisible();
  await expect(page.getByText(/Add and subtract whole numbers/).first()).toBeVisible();

  const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
  await page.getByLabel('Download report as a real PDF file').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cbe-report-.*\.pdf$/);
  // sanity: the PDF file has a PDF magic header
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  const head = readFileSync(path, 'utf8').slice(0, 5);
  expect(head).toBe('%PDF-');

  // ── 7. No console errors across the whole journey ─────────────────────────
  expect(consoleErrors).toEqual([]);
});

test('SLO deletion offers reassignment (REQ-C5)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('h1');

  await nav(page, 'Settings').click();
  await page.getByRole('button', { name: 'Curriculum Structure' }).click();
  await page.getByRole('button', { name: 'Expand strand Number' }).click();
  await page.getByRole('button', { name: 'Expand sub-strand Number Operations' }).click();

  // Delete the SLO that has a linked exam question → modal must offer reassignment
  await page.getByRole('button', { name: 'Delete SLO M.S1.SS1.1' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const reassignBtn = dialog.getByRole('button', { name: /Reassign & delete/i });
  await expect(reassignBtn).toBeVisible();
  await expect(reassignBtn).toBeDisabled(); // must pick a target first

  // Pick a replacement from the same learning area (index 0 = placeholder)
  const targetSelect = dialog.locator('select');
  await expect(targetSelect).toBeVisible();
  
  await targetSelect.selectOption({ index: 1 });
  await reassignBtn.click();
  await expect(dialog).not.toBeVisible();

  // M.S1.SS1.1 is gone; its linked question moved to the chosen replacement SLO
  await expect(page.getByText('M.S1.SS1.1')).toHaveCount(0);

  // restore: reset to sample data so the run leaves no mutations behind
  await page.getByRole('button', { name: 'Data Management' }).click();
  await page.getByRole('button', { name: 'Reset to sample data' }).click();
  const resetDialog = page.getByRole('dialog');
  await resetDialog.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(resetDialog).not.toBeVisible();
});
