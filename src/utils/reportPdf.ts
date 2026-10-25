/**
 * Offline PDF report generation (REQ-REP2 / REQ-DM5).
 * Writes a true A4-portrait PDF with jsPDF, dynamically imported so the library
 * is only fetched when the user clicks "Download PDF".
 * No network access is used — fully offline.
 */
import type { AppState } from '@/types';
import {
  getMasteryForLearningArea,
  getMasteryForStrand,
  getTopStrengths,
  getTopGaps,
  LEVEL_LABELS,
} from '@/utils/scoring';

type PdfDoc = import('jspdf').jsPDF;
type Rgb = [number, number, number];

const M = 16; // page margin (mm)
const PAGE_W = 210; // A4 portrait width (mm)
let cursorY = M;

function put(doc: PdfDoc, str: string, size: number, style: 'normal' | 'bold' | 'italic' | 'underline', colour?: Rgb, x: number = M, align: 'left' | 'right' | 'center' = 'left', y?: number): void {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  if (colour) doc.setTextColor(colour[0], colour[1], colour[2]);
  else doc.setTextColor(30, 35, 45);
  doc.text(str, x, y ?? cursorY, { align });
}

function heading(doc: PdfDoc, str: string): void {
  cursorY += 6;
  put(doc, str.toUpperCase(), 9, 'bold', [79, 70, 229]);
  cursorY += 1.2;
  doc.setDrawColor(99, 102, 241).setLineWidth(0.3).line(M, cursorY, PAGE_W - M, cursorY);
  cursorY += 5;
}

function wrapped(doc: PdfDoc, str: string, x: number = M, width: number = PAGE_W - 2 * M): void {
  const lines = doc.splitTextToSize(str, width) as string[];
  for (const l of lines) {
    put(doc, l, 9.5, 'normal', undefined, x);
    cursorY += 4.6;
  }
}

export async function downloadReportPDF(state: AppState, comments: string): Promise<void> {
  // Dynamic import → the jspdf bundle appears as its own lazy-loaded chunk
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const {
    learner, learningAreas, strands, subStrands, slos, exams, results, settings, actionPlan,
  } = state;
  const { thresholds } = settings;
  const targetArea = learningAreas[0];

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, PAGE_W, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('CBE Learner Progress Report', M, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date());
  doc.text(dateStr, PAGE_W - M, 11, { align: 'right' });
  cursorY = 28;

  // ── Learner profile block ─────────────────────────────────────────────────
  heading(doc, 'Learner');
  const overall = targetArea ? getMasteryForLearningArea(targetArea.id, exams, results, thresholds) : null;
  if (learner?.name) put(doc, learner.name, 12, 'bold');
  if (overall) put(doc, `${overall.pct}% — ${LEVEL_LABELS[overall.level]}`, 12, 'bold', [30, 130, 60], PAGE_W - M, 'right');
  cursorY += 5;
  wrapped(doc, `Basic ${learner?.grade ?? '—'} · ${learner?.school || '—'} · Academic year ${learner?.year ?? '—'}`);
  if (targetArea && overall) {
    wrapped(doc, `${targetArea.name} — overall performance ${overall.pct}% (${LEVEL_LABELS[overall.level]})`);
  }

  // ── Performance by strand ─────────────────────────────────────────────────
  const areaStrands = strands
    .filter((s) => s.learningAreaId === targetArea?.id)
    .sort((a, b) => a.order - b.order);
  heading(doc, 'Performance by Strand');
  if (areaStrands.length === 0) wrapped(doc, 'No strands defined yet.');
  for (const strand of areaStrands) {
    const m = getMasteryForStrand(strand.id, slos, exams, results, thresholds, subStrands);
    put(doc, `${strand.code} ${strand.name}`, 9.5, 'normal');
    put(doc, `${m.pct}%`, 9.5, 'bold', [30, 35, 45], PAGE_W - M, 'right', cursorY);
    // tiny progress bar under the row label
    const barY = cursorY - 3.2;
    const barW = 130;
    doc.setFillColor(229, 231, 235);
    doc.roundedRect(M, barY, barW, 2.4, 1.2, 1.2, 'F');
    const colours: Record<string, Rgb> = {
      EE: [34, 197, 94], ME: [59, 130, 246], AE: [245, 158, 11], BE: [239, 68, 68],
    };
    doc.setFillColor(...colours[m.level]);
    doc.roundedRect(M, barY, Math.max((barW * m.pct) / 100, 0.1), 2.4, 1.2, 1.2, 'F');
    cursorY += 7;
  }

  // ── Strengths ─────────────────────────────────────────────────────────────
  heading(doc, 'Top Strengths');
  const strengths = getTopStrengths(3, slos, exams, results, thresholds);
  if (strengths.length === 0) wrapped(doc, 'No mastery data yet.');
  for (const { slo, mastery } of strengths) {
    wrapped(doc, `• ${slo.code} ${slo.description} — ${mastery.pct}% (${mastery.level})`);
  }

  // ── Areas for further growth ──────────────────────────────────────────────
  heading(doc, 'Areas for Further Growth');
  const gaps = getTopGaps(3, slos, exams, results, thresholds);
  if (gaps.length === 0) wrapped(doc, 'No gaps identified — great work!');
  for (const { slo, mastery } of gaps) {
    wrapped(
      doc,
      `• ${slo.code} ${slo.description} — ${mastery.pct}% (${mastery.level}) ${
        mastery.level === 'BE' ? 'Building foundations — every step forward counts.' : 'Next step is ME.'
      }`,
    );
  }

  // ── Next steps (from the action plan) ─────────────────────────────────────
  heading(doc, 'Next Steps');
  const openItems = actionPlan.filter((i) => !i.completed).slice(0, 4);
  if (openItems.length === 0) wrapped(doc, 'No next steps planned yet — add gaps to the action plan.');
  for (const item of openItems) {
    wrapped(doc, `• ${item.activity} Review by ${item.reviewDate}.`);
  }

  // ── Comments ──────────────────────────────────────────────────────────────
  heading(doc, 'Teacher / Parent Comments');
  wrapped(doc, comments.trim() || '—');

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120, 125, 135);
  doc.text('Generated by CBE Exam Analysis — every step forward counts.', PAGE_W / 2, 285, { align: 'center' });

  const learnerSafe = learner?.name?.replace(/[^a-z0-9]+/gi, '-') ?? 'learner';
  const today = new Date().toISOString().slice(0, 10);
  doc.save(`cbe-report-${learnerSafe}-${today}.pdf`);
}
