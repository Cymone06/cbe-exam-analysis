/**
 * My Learners (REQ-ML2): cards with latest level summary, exam count and last
 * activity; add / edit / archive / delete with exact impact counts, copy
 * curriculum between learners, sample-learner and CSV bulk-add (REQ-ML6).
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Pencil, Archive, ArchiveRestore, Trash2, Copy, Sparkles, Upload,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/auth/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { learnerInitials } from '@/components/learners/LearnerSwitcher';
import { getLevel } from '@/utils/scoring';
import { parseLearnersCSV } from '@/utils/export';
import { loadAccountDoc } from '@/store/db';
import type { LearnerProfile } from '@/types';

const COLOURS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export function MyLearners() {
  const {
    state, createLearner, updateLearner, archiveLearner, deleteLearner,
    switchLearner, copyCurriculum, addSampleLearner, legacyDataAvailable, importLegacyData, importProgress,
  } = useApp();
  const { accountId } = useAuth();
  const navigate = useNavigate();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(6);
  const [school, setSchool] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [colour, setColour] = useState(COLOURS[0]);
  const [editing, setEditing] = useState<LearnerProfile | null>(null);
  const [deleting, setDeleting] = useState<LearnerProfile | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvError, setCsvError] = useState('');

  /* Learner cards read the full account doc so inactive learners show live stats. */
  const [stats, setStats] = useState<Record<string, { exams: number; results: number; plan: number; lastActivity: string | null }>>({});
  useEffect(() => {
    void (async () => {
      const doc = await loadAccountDoc(accountId);
      const s: typeof stats = {};
      for (const l of state.learners) {
        const ws = doc?.workspaces[l.id];
        if (ws) {
          const dates = ws.exams.map((e) => e.date).sort();
          s[l.id] = {
            exams: ws.exams.length,
            results: ws.results.length,
            plan: ws.actionPlan.length,
            lastActivity: dates[dates.length - 1] ?? null,
          };
        } else {
          s[l.id] = { exams: 0, results: 0, plan: 0, lastActivity: null };
        }
      }
      setStats(s);
    })();
  }, [state.learners, state.activeLearnerId, state.exams, state.results, state.actionPlan, accountId]);

  /* The active learner's overall level comes straight from current state. */
  const activeOverall = useMemo(() => {
    let scored = 0;
    let max = 0;
    for (const e of state.exams) {
      for (const q of e.questions) {
        const r = state.results.find((x) => x.examId === e.id && x.questionId === q.id);
        max += q.maxMarks;
        scored += Math.max(0, Math.min(r?.marksScored ?? 0, q.maxMarks));
      }
    }
    const pct = max > 0 ? Math.round((scored / max) * 100) : 0;
    return getLevel(pct, state.settings.thresholds);
  }, [state.exams, state.results, state.settings.thresholds]);

  const submitAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createLearner({ name: name.trim(), grade, school: school.trim(), year, colour });
    setName(''); setGrade(6); setSchool(''); setColour(COLOURS[0]);
    setAdding(false);
    navigate('/');
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    await updateLearner(editing.id, {
      name: editing.name.trim(), grade: editing.grade, school: editing.school, year: editing.year, colour: editing.colour,
    });
    setEditing(null);
  };

  /* bulk CSV add */
  const onCsvPicked = async (file: File) => {
    setCsvError('');
    try {
      const rows = parseLearnersCSV(await file.text());
      for (const row of rows) await createLearner(row);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Could not read the CSV file.');
    }
  };

  const deletingCounts = deleting ? stats[deleting.id] ?? { exams: 0, results: 0, plan: 0, lastActivity: null } : null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">My Learners</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add every child or student you analyse — switch between them any time.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={csvRef} type="file" accept=".csv" hidden
            aria-label="Bulk-add learners from a CSV file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onCsvPicked(f); }}
          />
          <Button variant="secondary" size="sm" onClick={() => csvRef.current?.click()}>
            <Upload size={14} /> Add from CSV
          </Button>
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus size={15} /> Add learner
          </Button>
        </div>
      </div>

      {csvError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{csvError}</p>}

      {legacyDataAvailable && (
        <Card>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-medium text-gray-800 dark:text-white">Import your existing data?</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                We found data already saved on this device. Move it into your account as your first learner — a backup is downloaded first.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void importLegacyData()}>
                Import my existing data
              </Button>
              <Button variant="ghost" size="sm" onClick={addSampleLearner}>
                <Sparkles size={14} /> Add sample learner
              </Button>
            </div>
          </div>
        </Card>
      )}

      {importProgress && (
        <Card>
          <p className="text-sm" role="status" aria-live="polite">
            {importProgress.stage === 'backup' && 'Downloading a backup first…'}
            {importProgress.stage === 'converting' && 'Preparing learner data…'}
            {importProgress.stage === 'saving' && 'Importing into your account…'}
            {importProgress.stage === 'done' && '✅ Imported! Your existing data is now this account\'s first learner.'}
            {importProgress.stage === 'error' && `❌ ${importProgress.error ?? 'Import failed'} — safe to retry, nothing was duplicated.`}
          </p>
        </Card>
      )}

      {(state.learners.length === 0) && (
        <Card>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No learners yet. Add your first learner or start with the sample data — every step forward counts.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {state.learners.map((l) => {
          const isActive = l.id === state.activeLearnerId;
          const st = stats[l.id] ?? { exams: 0, results: 0, plan: 0, lastActivity: null };
          return (
            <Card key={l.id} className={isActive ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''}>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: l.colour ?? '#6366f1' }}
                >
                  {learnerInitials(l.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-gray-800 dark:text-white truncate">{l.name}</h2>
                    {isActive && <Badge level={activeOverall} size="sm" />}
                    {l.archivedAt && <span className="text-xs text-amber-600 dark:text-amber-400">Archived</span>}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Basic {l.grade} · {l.school || 'No school set'} · {st.exams} exam{st.exams !== 1 ? 's' : ''} ·{' '}
                    {st.lastActivity ? `last activity ${st.lastActivity}` : 'no exams yet'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{st.results} results · {st.plan} plan items</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {!isActive && !l.archivedAt && (
                      <Button variant="ghost" size="sm" onClick={() => { void switchLearner(l.id); navigate('/'); }}>
                        Switch
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" aria-label={`Edit learner ${l.name}`} onClick={() => setEditing({ ...l })}>
                      <Pencil size={14} /> <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      aria-label={l.archivedAt ? `Unarchive learner ${l.name}` : `Archive learner ${l.name}`}
                      onClick={() => void archiveLearner(l.id, !l.archivedAt)}
                    >
                      {l.archivedAt ? <><ArchiveRestore size={14} /> Unarchive</> : <><Archive size={14} /> Archive</>}
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Delete learner ${l.name}`} onClick={() => setDeleting(l)}>
                      <Trash2 size={14} className="text-red-500" /> <span className="hidden sm:inline text-red-500">Delete</span>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {state.learners.length >= 2 && (
        <Card>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">Reuse a curriculum</p>
            <Button
              variant="secondary" size="sm"
              onClick={() => { setCopyOpen(true); setCopyFrom(state.learners.find((l) => l.id !== state.activeLearnerId)?.id ?? ''); }}
            >
              <Copy size={14} /> Copy curriculum from another learner
            </Button>
          </div>
        </Card>
      )}

      {/* Add learner */}
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a learner"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={submitAdd} disabled={!name.trim()}>Add learner</Button>
          </>
        }
      >
        <form onSubmit={submitAdd} className="space-y-3">
          <Input id="add-name" label="Learner's name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Ama Mensah" />
          <div className="grid grid-cols-2 gap-3">
            <Select id="add-grade" label="Grade" value={String(grade)} onChange={(e) => setGrade(Number(e.target.value))}
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Basic ${i + 1}` }))} />
            <Select id="add-year" label="Year" value={year} onChange={(e) => setYear(e.target.value)}
              options={Array.from({ length: 3 }, (_, i) => ({ value: String(new Date().getFullYear() - 1 + i), label: String(new Date().getFullYear() - 1 + i) }))} />
          </div>
          <Input id="add-school" label="School (optional)" value={school} onChange={(e) => setSchool(e.target.value)} />
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Colour</legend>
            <div className="flex gap-2 flex-wrap">
              {COLOURS.map((c) => (
                <button
                  key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={colour === c}
                  onClick={() => setColour(c)}
                  className={`w-7 h-7 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 ${colour === c ? 'ring-2 ring-offset-2 ring-gray-800 dark:ring-gray-200' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </fieldset>
        </form>
      </Modal>

      {/* Edit learner */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit learner"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={submitEdit} disabled={editing ? !editing.name.trim() : true}>Save</Button>
          </>
        }
      >
        {editing && (
          <form onSubmit={submitEdit} className="space-y-3">
            <Input id="edit-name" label="Learner's name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            <div className="grid grid-cols-2 gap-3">
              <Select id="edit-grade" label="Grade" value={String(editing.grade)} onChange={(e) => setEditing({ ...editing, grade: Number(e.target.value) })}
                options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Basic ${i + 1}` }))} />
              <Select id="edit-year" label="Year" value={editing.year} onChange={(e) => setEditing({ ...editing, year: e.target.value })}
                options={Array.from({ length: 3 }, (_, i) => ({ value: String(new Date().getFullYear() - 1 + i), label: String(new Date().getFullYear() - 1 + i) }))} />
            </div>
            <Input id="edit-school" label="School" value={editing.school} onChange={(e) => setEditing({ ...editing, school: e.target.value })} />
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Colour</legend>
              <div className="flex gap-2 flex-wrap">
                {COLOURS.map((c) => (
                  <button
                    key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={editing.colour === c}
                    onClick={() => setEditing({ ...editing, colour: c })}
                    className={`w-7 h-7 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 ${editing.colour === c ? 'ring-2 ring-offset-2 ring-gray-800 dark:ring-gray-200' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </fieldset>
          </form>
        )}
      </Modal>

      {/* Copy curriculum */}
      <Modal
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        title="Copy curriculum"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCopyOpen(false)}>Cancel</Button>
            <Button
              disabled={!copyFrom}
              onClick={() => { if (copyFrom) { void copyCurriculum(copyFrom); setCopyOpen(false); } }}
            >
              Copy
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3" id="copy-help">
          This replaces the active learner's curriculum ({state.learner?.name ?? '—'}) with a copy of another learner's — exams and results are not copied. You currently have {state.learners.length} learners.
        </p>
        <Select
          id="copy-select"
          value={copyFrom}
          onChange={(e) => setCopyFrom(e.target.value)}
          options={state.learners.filter((l) => l.id !== state.activeLearnerId).map((l) => ({ value: l.id, label: `${l.name} · Basic ${l.grade}` }))}
          placeholder="Choose a learner…"
        />
      </Modal>

      {/* Delete learner with exact counts (REQ-ML2) */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete learner?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { if (deleting) { void deleteLearner(deleting.id); setDeleting(null); } }}>
              Delete everything for {deleting?.name.split(' ')[0] ?? 'this learner'}
            </Button>
          </>
        }
      >
        <p className="text-gray-700 dark:text-gray-200">
          Delete <strong>{deleting?.name}</strong>?
        </p>
        {deletingCounts && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
            This permanently removes exactly {deletingCounts.exams} exam{deletingCounts.exams !== 1 ? 's' : ''},{' '}
            {deletingCounts.results} result{deletingCounts.results !== 1 ? 's' : ''} and{' '}
            {deletingCounts.plan} action-plan item{deletingCounts.plan !== 1 ? 's' : ''}. This cannot be undone — export a backup first if you need it.
          </p>
        )}
      </Modal>
    </div>
  );
}
