/**
 * End-to-end style integration test (jsdom + RTL):
 * create learner → add curriculum → create exam → enter marks →
 * view dashboard → export report (window.print) — REQ-L1, REQ-C2, REQ-E1/E2, REQ-R1/R4, REQ-D1, REQ-REP2.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { openDB } from 'idb';
import { AppProvider } from '@/store/AppContext';
import { INITIAL_STATE } from '@/store/AppContext';
import { AuthProvider } from '@/auth/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Dashboard } from '@/pages/Dashboard';
import { ExamList } from '@/pages/ExamList';
import { ExamEntry } from '@/pages/ExamEntry';
import { ResultEntry } from '@/pages/ResultEntry';
import { Report } from '@/pages/Report';
import { Settings } from '@/pages/Settings';

function Harness({ initialPath }: { initialPath: string }) {
  return (
    <AuthProvider>
      <AppProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <AppShell>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/exams" element={<ExamList />} />
              <Route path="/exams/new" element={<ExamEntry />} />
              <Route path="/exams/:id/results" element={<ResultEntry />} />
              <Route path="/report" element={<Report />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </AppShell>
        </MemoryRouter>
      </AppProvider>
    </AuthProvider>
  );
}

describe('full learner journey', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    // Pre-seed the (fake) IndexedDB with an empty app state so the app does
    // not load its sample data — the learner starts from scratch.
    const db = await openDB('cbe-exam-analysis', 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('appState')) d.createObjectStore('appState');
      },
    });
    await db.put('appState', INITIAL_STATE, 'state');
    db.close();
  });

  it('creates learner + curriculum + exam, enters marks, views dashboard and exports report', async () => {
    render(<Harness initialPath="/" />);
    const user = userEvent.setup();

    // Wait for rehydration to finish (sidebar navigation links appear)
    await screen.findAllByText('Exams', {}, { timeout: 5000 });

    // ── Step 1: create the learner profile ────────────────────────────────
    await user.click(screen.getAllByText('Settings')[0]);
    const nameInput = await screen.findByLabelText('Name', {}, { timeout: 3000 });
    await user.clear(nameInput);
    await user.type(nameInput, 'Kofi Test');
    const gradeInput = screen.getByLabelText(/Grade/);
    await user.clear(gradeInput);
    await user.type(gradeInput, '5');
    await user.click(screen.getByRole('button', { name: /Save Profile/i }));

    // ── Step 2: add curriculum (Learning Area → Strand → Sub-strand → SLO) ─
    await user.click(screen.getByText('Curriculum Structure'));
    const laInput = await screen.findByPlaceholderText('New learning area name');
    await user.type(laInput, 'ICT');
    await user.click(screen.getByRole('button', { name: /Add learning area/i }));
    await screen.findByText('ICT');

    const strandInput = await screen.findByPlaceholderText('New strand name');
    await user.type(strandInput, 'Digital Skills');
    await user.click(screen.getByRole('button', { name: /Add strand to ICT/i }));

    // Expand the strand to reveal its sub-strand editor
    await user.click(await screen.findByRole('button', { name: /Expand strand Digital Skills/i }));
    const ssInput = await screen.findByPlaceholderText('New sub-strand name');
    await user.type(ssInput, 'Typing');
    await user.click(screen.getByRole('button', { name: /Add sub-strand to Digital Skills/i }));

    await user.click(screen.getByRole('button', { name: /Expand sub-strand Typing/i }));
    const sloInput = await screen.findByPlaceholderText('New SLO description');
    await user.type(sloInput, 'Type thirty words per minute');
    await user.click(screen.getByRole('button', { name: /Add SLO to Typing/i }));
    expect(screen.getByText(/Type thirty words per minute/)).toBeInTheDocument();

    // ── Step 3: create an exam with a question linked to the SLO ──────────
    await user.click(screen.getAllByText('Exams')[0]);
    await user.click(screen.getByRole('link', { name: /Create your first exam/i }));
    const titleInput = await screen.findByLabelText(/Exam Title/);
    await user.type(titleInput, 'ICT CAT Term 1');
    await user.click(screen.getByRole('button', { name: /Next: Questions/i }));

    const search = await screen.findByLabelText('Search SLO by code or description');
    await user.type(search, 'thirty');
    await user.click(screen.getByText('Type thirty words per minute'));
    await user.click(screen.getByRole('button', { name: /Save Exam/i }));

    await screen.findByText('ICT CAT Term 1');
    screen.getByText('No results');

    // ── Step 4: enter marks ────────────────────────────────────────────────
    await user.click(screen.getByRole('button', { name: /Enter results/i }));
    const marksInput = await screen.findByLabelText('Marks for question 1');
    await user.type(marksInput, '7');
    // Real-time totals (REQ-R4): 7/10 = 70% → ME
    expect(await screen.findAllByText('70%')).toBeTruthy();

    // Extra validation check: marks above max are blocked (user-level requirement)
    await user.clear(marksInput);
    await user.type(marksInput, '15');
    await waitFor(() => expect(screen.getByText(/Marks cannot exceed/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Save Results/i })).toBeDisabled();
    await user.clear(marksInput);
    await user.type(marksInput, '7');
    await waitFor(() => expect(screen.getAllByText('70%').length).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: /Save Results/i }));
    await screen.findAllByText('70%');

    // ── Step 5: dashboard shows the latest exam summary ───────────────────
    await user.click(screen.getAllByText('Dashboard')[0]);
    expect(await screen.findByText(/Kofi Test's Dashboard/)).toBeInTheDocument();
    expect(screen.getAllByText('ICT CAT Term 1').length).toBeGreaterThan(0);

    // ── Step 6: report preview + PDF export (window.print) ───────────────
    await user.click(screen.getAllByText('Report')[0]);
    expect(await screen.findAllByText('CBE Learner Progress Report')).toBeTruthy();
    expect(screen.getAllByText('Kofi Test').length).toBeGreaterThan(0);
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await user.click(screen.getByRole('button', { name: /Export PDF/i }));
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  }, 30000);
});
