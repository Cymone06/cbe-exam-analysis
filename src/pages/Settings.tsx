import { useState, useRef, useEffect, type ReactNode, type Dispatch } from 'react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/auth/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { PasswordField } from '@/components/auth/PasswordField';
import {
  exportLearnerJSON, exportAccountJSON, exportCSV, parseImportFile, applyWorkspaceImport,
} from '@/utils/export';
import { loadAccountDoc } from '@/store/db';
import { AuthError } from '@/services/auth';
import {
  ChevronDown, ChevronRight, Plus, Trash2, Save, Download, Upload,
  Pencil, Check, X, RotateCcw, Database, KeyRound, Mail, UserMinus, AlertTriangle,
} from 'lucide-react';
import type {
  LearnerProfile, LearningArea, Strand, SubStrand, SLO, CoreCompetency,
} from '@/types';
import type { Action } from '@/store/AppContext';

type AppDispatch = Dispatch<Action>;
type Section = 'account' | 'learner' | 'levels' | 'curriculum' | 'competencies' | 'data' | 'theme';

/** A pending delete the user must confirm — with a count of affected data. */
interface PendingDelete {
  kind: 'learningArea' | 'strand' | 'subStrand' | 'slo' | 'competency';
  id: string;
  name: string;
  affected: string;
  /** For SLO deletes: other SLOs the linked questions could be reassigned to (REQ-C5). */
  reassignTargets?: SLO[];
  /** Number of exam questions referencing the entity. */
  linkedQuestions?: number;
}

function useAccordion() {
  const [open, setOpen] = useState<Section | null>('learner');
  const toggle = (s: Section) => setOpen((prev) => (prev === s ? null : s));
  return { open, toggle };
}

export function Settings() {
  const { state, dispatch } = useApp();
  const { user, authEnabled, accountId } = useAuth();
  const {
    learner, learningAreas, strands, subStrands, slos, competencies, exams, results, settings,
  } = state;
  const { open, toggle } = useAccordion();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null);

  // Learner form
  const [learnerForm, setLearnerForm] = useState<Omit<LearnerProfile, 'id'>>({
    name: learner?.name ?? '',
    grade: learner?.grade ?? 6,
    school: learner?.school ?? '',
    year: learner?.year ?? String(new Date().getFullYear()),
  });
  const [learnerError, setLearnerError] = useState('');

  const saveLearner = () => {
    if (!learnerForm.name.trim()) { setLearnerError('Name is required.'); return; }
    if (learnerForm.grade < 1 || learnerForm.grade > 12) {
      setLearnerError('Grade must be between 1 and 12.');
      return;
    }
    setLearnerError('');
    if (state.activeLearnerId && learner) {
      // update the ACTIVE learner (v2 multi-learner)
      dispatch({
        type: 'UPDATE_LEARNER',
        payload: { ...learner, ...learnerForm, colour: learner.colour ?? '#6366f1', archivedAt: learner.archivedAt ?? null },
      });
    } else {
      // first learner on a fresh workspace
      const profile: LearnerProfile = {
        id: learner?.id ?? 'learner-1',
        ...learnerForm,
        colour: '#6366f1',
        archivedAt: null,
      };
      dispatch({ type: 'SET_LEARNER', payload: profile });
      dispatch({ type: 'SET_ACCOUNT', payload: { learners: [profile], activeLearnerId: profile.id } });
    }
  };

  // Thresholds
  const [thresholds, setThresholds] = useState({ ...settings.thresholds });
  const saveThresholds = () => dispatch({ type: 'UPDATE_SETTINGS', payload: { thresholds } });

  // New entity modals
  const [newLAName, setNewLAName] = useState('');
  const [newLAColour, setNewLAColour] = useState('#6366f1');

  const addLA = () => {
    if (!newLAName.trim()) return;
    dispatch({
      type: 'ADD_LEARNING_AREA',
      payload: { id: `la-${Date.now()}`, name: newLAName.trim(), colour: newLAColour },
    });
    setNewLAName('');
  };

  // Import (REQ-EX1): validates schema, then asks merge or replace
  const [importMode, setImportMode] = useState<'merge' | 'replace' | null>(null);
  const [importedParsed, setImportedParsed] = useState<ReturnType<typeof parseImportFile> | null>(null);

  const handleImport = (file: File) => {
    setImportError('');
    setImportSuccess(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseImportFile(JSON.parse((e.target?.result as string) || 'null'));
        setImportedParsed(parsed);
        setImportMode(null);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  const applyImport = (mode: 'merge' | 'replace') => {
    if (!importedParsed) return;
    setImportMode(mode);
    const data = importedParsed.data as
      | import('@/types').LearnerWorkspace
      | Record<string, import('@/types').LearnerWorkspace>;
    const accountData = data as Record<string, import('@/types').LearnerWorkspace>;
    const workspace = importedParsed.kind === 'account'
      ? accountData[state.activeLearnerId ?? '']
      : (data as import('@/types').LearnerWorkspace);
    if (!workspace) { setImportError('This backup has no data for the active learner.'); return; }
    const { next } = applyWorkspaceImport(mode, workspace, {
      learningAreas, strands, subStrands, slos, competencies, exams, results, actionPlan: state.actionPlan,
    });
    dispatch({
      type: 'LOAD_STATE',
      payload: mode === 'replace'
        ? { ...next, settings: importedParsed.settings ? { ...settings, ...importedParsed.settings } : settings }
        : next,
    });
    setImportSuccess(true);
    setImportedParsed(null);
  };

  // ─── Delete confirmation ───────────────────────────────────────────────────
  const deleteDispatch = (p: PendingDelete) => {
    const actionMap = {
      learningArea: 'DELETE_LEARNING_AREA',
      strand: 'DELETE_STRAND',
      subStrand: 'DELETE_SUB_STRAND',
      slo: 'DELETE_SLO',
      competency: 'DELETE_COMPETENCY',
    } as const;
    dispatch({ type: actionMap[p.kind], payload: p.id } as Action);
  };

  /** Reassign an SLO's linked questions + plan items to another SLO, then delete it (REQ-C5). */
  const reassignDispatch = (p: PendingDelete, toSloId: string) => {
    dispatch({ type: 'REASSIGN_QUESTIONS_FROM_SLO', payload: { fromSloId: p.id, toSloId } } as Action);
    dispatch({ type: 'DELETE_SLO', payload: p.id } as Action);
  };

  const requestDeleteLA = (la: LearningArea) => {
    const areaStrands = strands.filter((s) => s.learningAreaId === la.id);
    const strandIds = new Set(areaStrands.map((s) => s.id));
    const areaSubStrands = subStrands.filter((ss) => strandIds.has(ss.strandId));
    const ssIds = new Set(areaSubStrands.map((ss) => ss.id));
    const areaSLOs = slos.filter((slo) => ssIds.has(slo.subStrandId));
    const areaExams = exams.filter((e) => e.learningAreaId === la.id);
    const questionCount = areaExams.flatMap((e) => e.questions)
      .filter((q) => areaSLOs.some((s) => s.id === q.sloId)).length;
    setPendingDelete({
      kind: 'learningArea',
      id: la.id,
      name: la.name,
      affected:
        `${areaStrands.length} strand${areaStrands.length !== 1 ? 's' : ''}, ` +
        `${areaSubStrands.length} sub-strand${areaSubStrands.length !== 1 ? 's' : ''}, ` +
        `${areaSLOs.length} SLO${areaSLOs.length !== 1 ? 's' : ''}, ` +
        `${areaExams.length} exam${areaExams.length !== 1 ? 's' : ''} and ${questionCount} linked question result${questionCount !== 1 ? 's' : ''}`,
    });
  };

  const requestDeleteStrand = (strand: Strand) => {
    const ssList = subStrands.filter((ss) => ss.strandId === strand.id);
    const ssIds = new Set(ssList.map((ss) => ss.id));
    const strandSLOs = slos.filter((slo) => ssIds.has(slo.subStrandId));
    const questionCount = exams.flatMap((e) => e.questions)
      .filter((q) => strandSLOs.some((s) => s.id === q.sloId)).length;
    setPendingDelete({
      kind: 'strand',
      id: strand.id,
      name: strand.name,
      affected:
        `${ssList.length} sub-strand${ssList.length !== 1 ? 's' : ''}, ` +
        `${strandSLOs.length} SLO${strandSLOs.length !== 1 ? 's' : ''}` +
        (questionCount > 0 ? `, plus ${questionCount} exam question${questionCount !== 1 ? 's' : ''} and their results` : ''),
    });
  };

  const requestDeleteSubStrand = (ss: SubStrand) => {
    const ssSLOs = slos.filter((slo) => slo.subStrandId === ss.id);
    const questionCount = exams.flatMap((e) => e.questions)
      .filter((q) => ssSLOs.some((s) => s.id === q.sloId)).length;
    setPendingDelete({
      kind: 'subStrand',
      id: ss.id,
      name: ss.name,
      affected:
        `${ssSLOs.length} SLO${ssSLOs.length !== 1 ? 's' : ''}` +
        (questionCount > 0 ? `, plus ${questionCount} exam question${questionCount !== 1 ? 's' : ''} and their results` : ''),
    });
  };

  const requestDeleteSLO = (slo: SLO) => {
    const linkedQuestions = exams.flatMap((e) => e.questions).filter((q) => q.sloId === slo.id);
    // Eligible reassignment targets: other SLOs in the same learning area (REQ-C5)
    const areaId = strands.find((st) =>
      subStrands.some((ss) => ss.id === slo.subStrandId && ss.strandId === st.id),
    )?.learningAreaId;
    const areaStrandIds = new Set(strands.filter((st) => st.learningAreaId === areaId).map((st) => st.id));
    const areaSubStrandIds = new Set(
      subStrands.filter((ss) => areaStrandIds.has(ss.strandId)).map((ss) => ss.id),
    );
    const targets = slos.filter((s) => s.id !== slo.id && areaSubStrandIds.has(s.subStrandId));
    setPendingDelete({
      kind: 'slo',
      id: slo.id,
      name: slo.description,
      linkedQuestions: linkedQuestions.length,
      affected: linkedQuestions.length > 0
        ? `${linkedQuestions.length} exam question${linkedQuestions.length !== 1 ? 's' : ''} and their results will also be removed`
        : 'no exam questions are linked to it',
      reassignTargets: targets,
    });
  };

  const requestDeleteCompetency = (c: CoreCompetency) => {
    const tagCount = exams.flatMap((e) => e.questions).filter((q) => q.competencyIds.includes(c.id)).length;
    setPendingDelete({
      kind: 'competency',
      id: c.id,
      name: c.name,
      affected: tagCount > 0
        ? `${tagCount} exam question${tagCount !== 1 ? 's' : ''} will have this tag removed (questions are kept)`
        : 'no exam questions are tagged with it',
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-5">Settings</h1>

      {/* Account (signed-in only — REQ-A6, REQ-A3) */}
      {authEnabled && user && (
        <AccordionSection title="Account" section="account" open={open} toggle={toggle}>
          <AccountSection
            userEmail={user.email ?? ''}
            idleLogoutMinutes={settings.idleLogoutMinutes ?? 30}
            keepSignedIn={settings.keepSignedIn ?? true}
            onIdleMinutesChange={(m) => dispatch({ type: 'UPDATE_SETTINGS', payload: { idleLogoutMinutes: m } })}
          />
        </AccordionSection>
      )}

      {/* Learner Profile */}
      <AccordionSection title="Learner Profile" section="learner" open={open} toggle={toggle}>
        <p className="text-xs text-gray-400 -mt-1 mb-2" id="active-learner-note">
          Editing <strong>{learner?.name || 'the active learner'}</strong>{' '}
          <span className="text-gray-300">·</span> manage all learners on the "My Learners" page.
        </p>
        <div className="space-y-3">
          <Input
            label="Name"
            value={learnerForm.name}
            onChange={(e) => setLearnerForm({ ...learnerForm, name: e.target.value })}
            error={learnerError}
            aria-describedby="active-learner-note"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Grade (1–12)"
              type="number"
              min={1}
              max={12}
              value={learnerForm.grade}
              onChange={(e) => setLearnerForm({ ...learnerForm, grade: Number(e.target.value) })}
            />
            <Input label="Year" value={learnerForm.year} onChange={(e) => setLearnerForm({ ...learnerForm, year: e.target.value })} />
          </div>
          <Input label="School" value={learnerForm.school} onChange={(e) => setLearnerForm({ ...learnerForm, school: e.target.value })} />
          <Button onClick={saveLearner}><Save size={14} /> Save Profile</Button>
        </div>
      </AccordionSection>

      {/* Performance Levels */}
      <AccordionSection title="Performance Level Thresholds" section="levels" open={open} toggle={toggle}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Set the lower bound (%) for each level. Saved thresholds immediately re-calculate all results and charts.
          </p>
          {(['EE', 'ME', 'AE'] as const).map((level) => (
            <div key={level} className="flex items-center gap-3">
              <Badge level={level} />
              <Input
                type="number"
                min={0}
                max={100}
                value={thresholds[level]}
                onChange={(e) => setThresholds({ ...thresholds, [level]: Number(e.target.value) })}
                className="w-24"
                aria-label={`${level} threshold`}
              />
              <span className="text-sm text-gray-500">% and above</span>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <Badge level="BE" />
            <span className="text-sm text-gray-500">0 – {Math.max(0, thresholds.AE - 1)}%</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.subLevelEnabled}
                onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', payload: { subLevelEnabled: e.target.checked } })}
                className="accent-indigo-600"
              />
              Enable 8-point sub-level scale (EE2, EE1, ME2…)
            </label>
          </div>
          <Button onClick={saveThresholds}><Save size={14} /> Save Thresholds</Button>
        </div>
      </AccordionSection>

      {/* Curriculum */}
      <AccordionSection title="Curriculum Structure" section="curriculum" open={open} toggle={toggle}>
        <div className="space-y-4">
          {/* Learning Areas */}
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Learning Areas</h3>
            <div className="space-y-1">
              {learningAreas.map((la) => (
                <EditableRow
                  key={la.id}
                  label={la.name}
                  swatch={la.colour}
                  ariaLabel={`${la.name} learning area`}
                  onSave={(name) => dispatch({ type: 'UPDATE_LEARNING_AREA', payload: { ...la, name } })}
                  onDelete={() => requestDeleteLA(la)}
                />
              ))}
              {learningAreas.length === 0 && (
                <p className="text-xs text-gray-400 py-1">No learning areas yet — add one below.</p>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <Input placeholder="New learning area name" value={newLAName} onChange={(e) => setNewLAName(e.target.value)} />
              <input type="color" value={newLAColour} onChange={(e) => setNewLAColour(e.target.value)} className="rounded border border-gray-300 dark:border-gray-600 w-10 h-10 cursor-pointer shrink-0" aria-label="Pick colour" />
              <Button size="sm" onClick={addLA} aria-label="Add learning area"><Plus size={14} /></Button>
            </div>
          </div>

          {/* Strands / Sub-strands / SLOs - show tree */}
          {learningAreas.map((la) => (
            <StrandEditor
              key={la.id}
              la={la}
              strands={strands}
              subStrands={subStrands}
              slos={slos}
              dispatch={dispatch}
              requestDeleteStrand={requestDeleteStrand}
              requestDeleteSubStrand={requestDeleteSubStrand}
              requestDeleteSLO={requestDeleteSLO}
            />
          ))}
        </div>
      </AccordionSection>

      {/* Core Competencies */}
      <AccordionSection title="Core Competencies" section="competencies" open={open} toggle={toggle}>
        <CompetencyEditor competencies={competencies} dispatch={dispatch} requestDelete={requestDeleteCompetency} />
      </AccordionSection>

      {/* Data Management */}
      <AccordionSection title="Data Management" section="data" open={open} toggle={toggle}>
        <div className="space-y-3">
          <Button variant="secondary" onClick={() => exportLearnerJSON(state)} className="w-full justify-start">
            <Download size={15} /> Export this learner (JSON)
          </Button>
          <Button
            variant="secondary"
            onClick={() => { void loadAccountDoc(accountId).then((d) => { if (d) exportAccountJSON(d); }); }}
            className="w-full justify-start"
          >
            <Download size={15} /> Export whole account (all learners)
          </Button>
          <Button variant="secondary" onClick={() => exportCSV(exams, results, slos, learningAreas, learner?.name ?? '')} className="w-full justify-start">
            <Download size={15} /> Export CSV (all results)
          </Button>
          <div>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} className="w-full justify-start">
              <Upload size={15} /> Import JSON backup
            </Button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
            {importError && <p className="text-xs text-red-600 mt-1">{importError}</p>}
            {importSuccess && <p className="text-xs text-green-600 mt-1">✓ Import successful!</p>}
            <p className="text-xs text-gray-400 mt-1">Choosing merge keeps rows that aren't in the backup; replace overwrites this learner's data.</p>
          </div>
          <hr className="border-gray-200 dark:border-gray-700" />
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Danger zone</p>
            <Button variant="ghost" onClick={() => setConfirmAction('reset')} className="w-full justify-start border border-gray-200 dark:border-gray-700">
              <RotateCcw size={15} /> Reset to sample data
            </Button>
            <p className="text-xs text-gray-400 ml-1">Restores the original demo learner and two sample exams. Replaces all current data.</p>
            <Button variant="danger" onClick={() => setConfirmAction('clear')} className="w-full justify-start sm:w-auto">
              <Database size={15} /> Clear all data
            </Button>
            <p className="text-xs text-gray-400 ml-1">Permanently removes your profile, curriculum, exams, results and plan. Same as deleting data from this device.</p>
          </div>
        </div>
      </AccordionSection>

      {/* Theme */}
      <AccordionSection title="Theme" section="theme" open={open} toggle={toggle}>
        <div className="flex gap-3">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              onClick={() => dispatch({ type: 'UPDATE_SETTINGS', payload: { theme: t } })}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 capitalize ${
                settings.theme === t
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400 hover:border-indigo-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </AccordionSection>

      {/* Delete confirmation modal (REQ-C5: warning + reassignment OR cascade-delete) */}
      <SLODeleteModal
        pending={pendingDelete}
        onClose={() => setPendingDelete(null)}
        deleteDispatch={deleteDispatch}
        reassignDispatch={reassignDispatch}
      />

      {/* Reset / clear confirmations */}
      <Modal
        open={confirmAction === 'reset'}
        onClose={() => setConfirmAction(null)}
        title="Reset to sample data"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => { dispatch({ type: 'RESET_SAMPLE_DATA' }); setConfirmAction(null); }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-300">
          All current data (profile, curriculum, exams, results and plan) will be replaced by the original sample data. This cannot be undone — export a JSON backup first if you need it.
        </p>
      </Modal>
      <Modal
        open={confirmAction === 'clear'}
        onClose={() => setConfirmAction(null)}
        title="Clear all data"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => { dispatch({ type: 'CLEAR_ALL_DATA' }); setConfirmAction(null); }}
            >
              Clear everything
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-300">
          All data on this device will be permanently removed — learner profile, curriculum, exams, results and action plan. This cannot be undone — export a JSON backup first if you need it.
        </p>
      </Modal>

      {/* Import merge/replace choice (REQ-EX1) */}
      <Modal
        open={importedParsed !== null && importMode === null}
        onClose={() => { setImportedParsed(null); setImportMode(null); }}
        title="Merge or replace?"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setImportedParsed(null); setImportMode(null); }}>Cancel</Button>
            <Button variant="secondary" onClick={() => applyImport('merge')}>Merge</Button>
            <Button onClick={() => applyImport('replace')}>Replace</Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-300">
          Merge keeps the current data and adds/updates rows found in the backup (no duplicates). Replace overwrites the active learner's data with the backup.
        </p>
      </Modal>
    </div>
  );
}

// ─── Delete confirmation modal with optional reassignment (REQ-C5) ───────────

function SLODeleteModal({
  pending, onClose, deleteDispatch, reassignDispatch,
}: {
  pending: PendingDelete | null;
  onClose: () => void;
  deleteDispatch: (p: PendingDelete) => void;
  reassignDispatch: (p: PendingDelete, toSloId: string) => void;
}) {
  const targets = pending?.reassignTargets ?? [];
  const isSLO = pending?.kind === 'slo';
  const canReassign = isSLO && targets.length > 0;
  const [reassignTo, setReassignTo] = useState('');

  // Reset the chosen target whenever a new delete request opens
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- form reset when a different delete dialog opens
    setReassignTo('');
  }, [pending?.id]);

  return (
    <Modal
      open={pending !== null}
      onClose={onClose}
      title="Delete with cascade?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {canReassign && (
            <Button
              variant="primary"
              disabled={!reassignTo}
              onClick={() => {
                if (pending && reassignTo) {
                  reassignDispatch(pending, reassignTo);
                  onClose();
                }
              }}
            >
              Reassign &amp; delete
            </Button>
          )}
          <Button
            variant="danger"
            onClick={() => { if (pending) { deleteDispatch(pending); onClose(); } }}
          >
            Delete
          </Button>
        </>
      }
    >
      <p className="text-gray-600 dark:text-gray-300">
        Delete <strong>{pending?.name}</strong>?
      </p>
      {pending?.affected && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          This will also remove: {pending.affected}. This cannot be undone.
        </p>
      )}
      {canReassign && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <label htmlFor="reassign-slo-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Or keep the linked questions and their results
          </label>
          <Select
            id="reassign-slo-select"
            value={reassignTo}
            onChange={(e) => setReassignTo(e.target.value)}
            placeholder="Choose a replacement SLO..."
            options={[
              ...targets.map((t) => ({ value: t.id, label: `${t.code} — ${t.description.slice(0, 60)}` })),
            ]}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            Pick a replacement SLO above and press "Reassign &amp; delete" to move the linked questions to it — no marks are lost.
          </p>
        </div>
      )}
    </Modal>
  );
}

// ─── Shared row with inline rename + delete ───────────────────────────────────

function EditableRow({
  label, prefix, swatch, mono, ariaLabel, onSave, onDelete,
}: {
  label: string;
  prefix?: string;
  swatch?: string;
  mono?: boolean;
  ariaLabel: string;
  onSave: (newLabel: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const start = () => { setDraft(label); setEditing(true); };

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1">
        {prefix && <span className={`text-[11px] text-indigo-500 shrink-0 ${mono ? 'font-mono' : ''}`}>{prefix}</span>}
        {swatch && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: swatch }} />}
        <input
          className="flex-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { onSave(draft); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
          aria-label={`Rename ${ariaLabel}`}
          autoFocus
        />
        <Button variant="ghost" size="sm" aria-label="Save rename" onClick={() => { onSave(draft); setEditing(false); }}>
          <Check size={14} className="text-green-600" />
        </Button>
        <Button variant="ghost" size="sm" aria-label="Cancel rename" onClick={() => setEditing(false)}>
          <X size={14} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1">
      {prefix && <span className={`text-indigo-500 shrink-0 truncate ${mono ? 'text-[11px] font-mono' : ''}`}>{prefix}</span>}
      {swatch && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: swatch }} />}
      <span className={`flex-1 min-w-0 truncate ${mono ? 'text-sm font-mono' : 'text-sm'}`}>{label}</span>
      <Button variant="ghost" size="sm" onClick={start} aria-label={`Rename ${ariaLabel}`}>
        <Pencil size={13} />
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete ${ariaLabel}`}>
        <Trash2 size={13} className="text-red-400" />
      </Button>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StrandEditorProps {
  la: LearningArea;
  strands: Strand[];
  subStrands: SubStrand[];
  slos: SLO[];
  dispatch: AppDispatch;
  requestDeleteStrand: (s: Strand) => void;
  requestDeleteSubStrand: (ss: SubStrand) => void;
  requestDeleteSLO: (slo: SLO) => void;
}

function AccordionSection({
  title, section, open, toggle, children,
}: {
  title: string; section: Section;
  open: Section | null; toggle: (s: Section) => void;
  children: ReactNode;
}) {
  const isOpen = open === section;
  return (
    <Card padding={false}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 rounded-xl"
        onClick={() => toggle(section)}
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-gray-700 dark:text-gray-200">{title}</span>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </Card>
  );
}

function StrandEditor({
  la, strands, subStrands, slos, dispatch,
  requestDeleteStrand, requestDeleteSubStrand, requestDeleteSLO,
}: StrandEditorProps) {
  const [newStrandName, setNewStrandName] = useState('');
  const areaStrands = strands.filter((s) => s.learningAreaId === la.id).sort((a, b) => a.order - b.order);
  const [openStrand, setOpenStrand] = useState<string | null>(null);

  const addStrand = () => {
    if (!newStrandName.trim()) return;
    dispatch({
      type: 'ADD_STRAND',
      payload: {
        id: `s-${Date.now()}`,
        learningAreaId: la.id,
        code: `${la.name.slice(0, 1).toUpperCase()}.S${areaStrands.length + 1}`,
        name: newStrandName.trim(),
        order: areaStrands.length + 1,
      },
    });
    setNewStrandName('');
  };

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
      <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{la.name} — Strands</p>
      {areaStrands.map((strand) => (
        <div key={strand.id} className="mb-1">
          <div className="flex items-center gap-2">
            <button
              className="text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
              onClick={() => setOpenStrand(openStrand === strand.id ? null : strand.id)}
              aria-label={`${openStrand === strand.id ? 'Collapse' : 'Expand'} strand ${strand.name}`}
              aria-expanded={openStrand === strand.id}
            >
              {openStrand === strand.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <div className="flex-1 min-w-0 group">
              <EditableRow
                label={strand.name}
                prefix={strand.code}
                ariaLabel={`strand ${strand.name}`}
                onSave={(name) => dispatch({ type: 'UPDATE_STRAND', payload: { ...strand, name } })}
                onDelete={() => requestDeleteStrand(strand)}
              />
            </div>
          </div>
          {openStrand === strand.id && (
            <SubStrandEditor
              strand={strand}
              subStrands={subStrands}
              slos={slos}
              dispatch={dispatch}
              requestDeleteSubStrand={requestDeleteSubStrand}
              requestDeleteSLO={requestDeleteSLO}
            />
          )}
        </div>
      ))}
      {areaStrands.length === 0 && <p className="text-xs text-gray-400 py-1">No strands yet — add one below.</p>}
      <div className="flex gap-2 mt-2">
        <Input placeholder="New strand name" value={newStrandName} onChange={(e) => setNewStrandName(e.target.value)} />
        <Button size="sm" onClick={addStrand} aria-label={`Add strand to ${la.name}`}><Plus size={13} /></Button>
      </div>
    </div>
  );
}

interface SubStrandEditorProps {
  strand: Strand;
  subStrands: SubStrand[];
  slos: SLO[];
  dispatch: AppDispatch;
  requestDeleteSubStrand: (ss: SubStrand) => void;
  requestDeleteSLO: (slo: SLO) => void;
}

function SubStrandEditor({
  strand, subStrands, slos, dispatch,
  requestDeleteSubStrand, requestDeleteSLO,
}: SubStrandEditorProps) {
  const [newName, setNewName] = useState('');
  const strandSubStrands = subStrands.filter((ss) => ss.strandId === strand.id).sort((a, b) => a.order - b.order);
  const [openSS, setOpenSS] = useState<string | null>(null);

  const add = () => {
    if (!newName.trim()) return;
    dispatch({
      type: 'ADD_SUB_STRAND',
      payload: {
        id: `ss-${Date.now()}`,
        strandId: strand.id,
        code: `${strand.code}.SS${strandSubStrands.length + 1}`,
        name: newName.trim(),
        order: strandSubStrands.length + 1,
      },
    });
    setNewName('');
  };

  return (
    <div className="ml-4 mt-1 space-y-1">
      {strandSubStrands.map((ss) => (
        <div key={ss.id}>
          <div className="flex items-center gap-2">
            <button
              className="text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
              onClick={() => setOpenSS(openSS === ss.id ? null : ss.id)}
              aria-label={`${openSS === ss.id ? 'Collapse' : 'Expand'} sub-strand ${ss.name}`}
              aria-expanded={openSS === ss.id}
            >
              {openSS === ss.id ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
            <div className="flex-1 min-w-0">
              <EditableRow
                label={ss.name}
                prefix={ss.code}
                mono
                ariaLabel={`sub-strand ${ss.name}`}
                onSave={(name) => dispatch({ type: 'UPDATE_SUB_STRAND', payload: { ...ss, name } })}
                onDelete={() => requestDeleteSubStrand(ss)}
              />
            </div>
          </div>
          {openSS === ss.id && (
            <SLOEditor
              subStrand={ss}
              slos={slos}
              dispatch={dispatch}
              requestDeleteSLO={requestDeleteSLO}
            />
          )}
        </div>
      ))}
      {strandSubStrands.length === 0 && <p className="text-xs text-gray-400 py-1">No sub-strands yet — add one below.</p>}
      <div className="flex gap-2 mt-1">
        <Input placeholder="New sub-strand name" value={newName} onChange={(e) => setNewName(e.target.value)} className="text-xs" />
        <Button size="sm" onClick={add} aria-label={`Add sub-strand to ${strand.name}`}><Plus size={11} /></Button>
      </div>
    </div>
  );
}

function SLOEditor({
  subStrand, slos, dispatch, requestDeleteSLO,
}: {
  subStrand: SubStrand;
  slos: SLO[];
  dispatch: AppDispatch;
  requestDeleteSLO: (slo: SLO) => void;
}) {
  const [newDesc, setNewDesc] = useState('');
  const subSLOs = slos.filter((s) => s.subStrandId === subStrand.id);
  const add = () => {
    if (!newDesc.trim()) return;
    dispatch({
      type: 'ADD_SLO',
      payload: {
        id: `slo-${Date.now()}`,
        subStrandId: subStrand.id,
        code: `${subStrand.code}.${subSLOs.length + 1}`,
        description: newDesc.trim(),
        weight: 1,
      },
    });
    setNewDesc('');
  };
  return (
    <div className="ml-4 mt-1 space-y-1">
      {subSLOs.map((slo) => (
        <SLORow key={slo.id} slo={slo} dispatch={dispatch} onDelete={() => requestDeleteSLO(slo)} />
      ))}
      {subSLOs.length === 0 && <p className="text-xs text-gray-400 py-1">No SLOs yet — add one below.</p>}
      <div className="flex gap-2 mt-1">
        <Input placeholder="New SLO description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="text-xs" />
        <Button size="sm" onClick={add} aria-label={`Add SLO to ${subStrand.name}`}><Plus size={11} /></Button>
      </div>
    </div>
  );
}

function SLORow({ slo, dispatch, onDelete }: { slo: SLO; dispatch: AppDispatch; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(slo.description);
  const [weightDraft, setWeightDraft] = useState(String(slo.weight));

  const commit = () => {
    const weight = Math.max(0.5, Math.min(5, Number(weightDraft) || 1));
    dispatch({
      type: 'UPDATE_SLO',
      payload: { ...slo, description: draft.trim(), weight },
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1 flex-wrap">
        <span className="text-xs font-mono text-indigo-500 w-28 shrink-0">{slo.code}</span>
        <input
          className="flex-1 min-w-[160px] text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`Edit SLO ${slo.code} description`}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
        />
        <label className="text-xs text-gray-500 flex items-center gap-1">
          Weight
          <input
            type="number"
            min={0.5}
            max={5}
            step={0.5}
            className="w-14 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={weightDraft}
            onChange={(e) => setWeightDraft(e.target.value)}
            aria-label={`Edit SLO ${slo.code} priority weight`}
          />
        </label>
        <Button variant="ghost" size="sm" aria-label="Save SLO" onClick={commit}><Check size={14} className="text-green-600" /></Button>
        <Button variant="ghost" size="sm" aria-label="Cancel SLO edit" onClick={() => setEditing(false)}><X size={14} /></Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-indigo-500 w-28 shrink-0 truncate">{slo.code}</span>
      <span className="text-xs flex-1 min-w-0 truncate text-gray-600 dark:text-gray-400">{slo.description}</span>
      {slo.weight !== 1 && (
        <span className="text-[10px] text-gray-400 shrink-0" title="Priority weight">w={slo.weight}</span>
      )}
      <Button variant="ghost" size="sm" aria-label={`Edit SLO ${slo.code}`} onClick={() => { setDraft(slo.description); setWeightDraft(String(slo.weight)); setEditing(true); }}>
        <Pencil size={10} />
      </Button>
      <Button variant="ghost" size="sm" aria-label={`Delete SLO ${slo.code}`} onClick={onDelete}>
        <Trash2 size={10} className="text-red-400" />
      </Button>
    </div>
  );
}

function CompetencyEditor({
  competencies, dispatch, requestDelete,
}: {
  competencies: CoreCompetency[];
  dispatch: AppDispatch;
  requestDelete: (c: CoreCompetency) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftShort, setDraftShort] = useState('');
  const [newName, setNewName] = useState('');
  const [newShort, setNewShort] = useState('');
  const [newColour, setNewColour] = useState('#6366f1');

  const add = () => {
    if (!newName.trim() || !newShort.trim()) return;
    dispatch({
      type: 'ADD_COMPETENCY',
      payload: { id: `cc-${Date.now()}`, name: newName.trim(), shortName: newShort.trim(), colour: newColour },
    });
    setNewName(''); setNewShort('');
  };

  const saveEdit = (c: CoreCompetency) => {
    if (!draftName.trim() || !draftShort.trim()) { setEditId(null); return; }
    dispatch({ type: 'UPDATE_COMPETENCY', payload: { ...c, name: draftName.trim(), shortName: draftShort.trim() } });
    setEditId(null);
  };

  return (
    <div className="space-y-2">
      {competencies.map((c) => (
        editId === c.id ? (
          <div key={c.id} className="flex items-center gap-2 flex-wrap">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.colour }} />
            <input
              className="flex-1 min-w-[140px] text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              aria-label={`Edit full name for ${c.name}`}
              placeholder="Full name"
            />
            <input
              className="w-32 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={draftShort}
              onChange={(e) => setDraftShort(e.target.value)}
              aria-label={`Edit short name for ${c.name}`}
              placeholder="Short name"
            />
            <Button variant="ghost" size="sm" aria-label="Save competency" onClick={() => saveEdit(c)}>
              <Check size={14} className="text-green-600" />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Cancel editing competency" onClick={() => setEditId(null)}>
              <X size={14} />
            </Button>
          </div>
        ) : (
          <div key={c.id} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.colour }} />
            <span className="text-sm flex-1 min-w-0 truncate">{c.name}</span>
            <Button
              variant="ghost" size="sm"
              aria-label={`Rename ${c.name}`}
              onClick={() => { setEditId(c.id); setDraftName(c.name); setDraftShort(c.shortName); }}
            >
              <Pencil size={13} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => requestDelete(c)} aria-label={`Delete ${c.name}`}>
              <Trash2 size={13} className="text-red-400" />
            </Button>
          </div>
        )
      ))}
      {competencies.length === 0 && <p className="text-xs text-gray-400 py-1">No competencies yet — add one below.</p>}
      <div className="grid grid-cols-[1fr_100px_36px_36px] gap-2 mt-2">
        <Input placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Input placeholder="Short name" value={newShort} onChange={(e) => setNewShort(e.target.value)} />
        <input type="color" value={newColour} onChange={(e) => setNewColour(e.target.value)} className="rounded border border-gray-300 dark:border-gray-600 w-10 h-10 cursor-pointer" aria-label="Competency colour" />
        <Button size="sm" onClick={add} aria-label="Add competency"><Plus size={14} /></Button>
      </div>
    </div>
  );
}

/* ─── Account management (REQ-A6, REQ-A3, REQ-A7) ──────────────────────────── */

function AccountSection({ userEmail, idleLogoutMinutes, keepSignedIn, onIdleMinutesChange }: {
  userEmail: string;
  idleLogoutMinutes: number;
  keepSignedIn: boolean;
  onIdleMinutesChange: (minutes: number) => void;
}) {
  const { updatePassword, updateEmail, deleteAccount, signOut, setKeepSignedIn } = useAuth();
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typedConfirm, setTypedConfirm] = useState('');
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const savePassword = async () => {
    setPwMsg(null);
    if (newPw.length < 8) { setPwMsg({ ok: false, text: 'Use at least 8 characters.' }); return; }
    try {
      await updatePassword(newPw);
      setNewPw('');
      setPwMsg({ ok: true, text: 'Password updated.' });
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof AuthError ? err.message : 'Could not update the password.' });
    }
  };

  const saveEmail = async () => {
    setEmailMsg(null);
    if (!newEmail.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail.trim())) {
      setEmailMsg({ ok: false, text: 'Enter a valid email address.' });
      return;
    }
    try {
      await updateEmail(newEmail.trim());
      setEmailMsg({ ok: true, text: `Confirmation sent to ${newEmail.trim()} — it becomes your sign-in email after you verify.` });
      setNewEmail('');
    } catch (err) {
      setEmailMsg({ ok: false, text: err instanceof AuthError ? err.message : 'Could not change the email.' });
    }
  };

  const doDelete = async () => {
    setDeleteMsg(null);
    setDeleteBusy(true);
    try {
      await deleteAccount(typedConfirm);
      await signOut();
      setDeleteOpen(false);
    } catch (err) {
      setDeleteMsg(err instanceof AuthError ? err.message : 'Account deletion failed. Please try again.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Change password */}
      <div>
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
          <KeyRound size={14} /> Change password
        </h3>
        <PasswordField
          id="acc-password" label="New password" value={newPw} onChange={setNewPw}
        />
        {pwMsg && (
          <p className={`text-xs mt-1 ${pwMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} aria-live="polite">
            {pwMsg.text}
          </p>
        )}
        <Button size="sm" className="mt-2" onClick={() => void savePassword()} disabled={newPw.length < 8}>
          Update password
        </Button>
      </div>

      {/* Change email */}
      <div>
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
          <Mail size={14} /> Sign-in email
        </h3>
        <p className="text-xs text-gray-400 mb-2">Currently {userEmail}</p>
        <Input
          id="acc-email" label="New email" type="email" value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)} autoComplete="email"
        />
        {emailMsg && (
          <p className={`text-xs mt-1 ${emailMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} aria-live="polite">
            {emailMsg.text}
          </p>
        )}
        <Button size="sm" className="mt-2" onClick={() => void saveEmail()} disabled={newEmail.trim() === ''}>
          Change email
        </Button>
      </div>

      {/* Session preferences */}
      <div>
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Stay signed in</h3>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            defaultChecked={keepSignedIn}
            onChange={(e) => setKeepSignedIn(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            aria-describedby="keep-signed-in-help"
          />
          Keep me signed in on this device
        </label>
        <p id="keep-signed-in-help" className="text-xs text-gray-400 mt-1 ml-6">
          (The login screen also asks this; you can change it here any time.)
        </p>
        <div className="mt-3 max-w-64">
          <Select
            id="idle-minutes"
            label="Sign me out after inactivity"
            value={String(idleLogoutMinutes)}
            onChange={(e) => onIdleMinutesChange(Number(e.target.value))}
            options={[
              { value: '0', label: 'Never (not recommended)' },
              { value: '5', label: '5 minutes' },
              { value: '10', label: '10 minutes' },
              { value: '15', label: '15 minutes' },
              { value: '30', label: '30 minutes (recommended)' },
              { value: '60', label: '1 hour' },
            ]}
          />
          <p className="text-xs text-gray-400 mt-1">A warning appears 1 minute before sign-out.</p>
        </div>
      </div>

      {/* Delete account */}
      <div>
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
          <UserMinus size={14} /> Delete account
        </h3>
        <p className="text-xs text-gray-400 mb-2">
          Permanently removing your account also deletes every learner, exam, result and plan from the cloud. This cannot be undone.
        </p>
        <Button variant="danger" size="sm" onClick={() => { setDeleteOpen(true); setTypedConfirm(''); setDeleteMsg(null); }}>
          Delete my account
        </Button>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete account permanently?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={typedConfirm.trim().toLowerCase() !== userEmail.toLowerCase() || deleteBusy} onClick={() => void doDelete()}>
              {deleteBusy ? 'Deleting…' : 'Delete my account'}
            </Button>
          </>
        }
      >
        <p className="text-gray-700 dark:text-gray-200 mb-1">
          Type your email <strong>{userEmail}</strong> to confirm. After deletion you are signed out and all cloud data for the account is gone.
        </p>
        <Input
          id="delete-account-confirm"
          label="Type your email to confirm"
          value={typedConfirm}
          onChange={(e) => setTypedConfirm(e.target.value)}
          aria-describedby="delete-account-msg"
        />
        {deleteMsg && (
          <p id="delete-account-msg" role="alert" className="text-sm text-red-600 dark:text-red-400 mt-2">
            <AlertTriangle size={13} className="inline mr-1" />{deleteMsg}
          </p>
        )}
      </Modal>
    </div>
  );
}

