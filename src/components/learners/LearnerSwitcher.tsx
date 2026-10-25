/**
 * LearnerSwitcher — always-visible active learner dropdown (REQ-ML3),
 * keyboard accessible, persists the active learner via the account cache.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Users } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import type { LearnerProfile } from '@/types';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '').toUpperCase();
}

export function LearnerSwitcher({ compact = false }: { compact?: boolean }) {
  const { state, switchLearner } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = state.learners.find((l) => l.id === state.activeLearnerId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => navigate('/learners')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-2 py-1"
      >
        <Users size={compact ? 15 : 16} /> Add a learner
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active learner: ${active.name}. Switch learner`}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white shrink-0"
          style={{ backgroundColor: active.colour ?? '#6366f1' }}
        >
          {initials(active.name)}
        </span>
        {!compact && <span className="max-w-28 truncate">{active.name}</span>}
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Switch learner"
          className="absolute left-0 mt-1 min-w-56 max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-50 py-1"
        >
          {state.learners.filter((l) => !l.archivedAt).map((l) => (
            <button
              key={l.id}
              type="button"
              role="option"
              aria-selected={l.id === active.id}
              onClick={() => {
                setOpen(false);
                if (l.id !== active.id) {
                  void switchLearner(l.id);
                  navigate('/');
                }
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:bg-indigo-50 dark:focus-visible:bg-indigo-900/40 ${
                l.id === active.id ? 'font-semibold text-indigo-600 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              <span
                aria-hidden="true"
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: l.colour ?? '#6366f1' }}
              >
                {initials(l.name)}
              </span>
              <span className="truncate">
                {l.name} <span className="text-gray-400 font-normal">· Basic {l.grade}</span>
              </span>
            </button>
          ))}
          <div className="border-t border-gray-100 dark:border-gray-800 mt-1 pt-1">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/learners'); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none"
            >
              <Users size={15} /> Manage learners…
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function learnerInitials(name: string): string {
  return initials(name);
}

export type { LearnerProfile };
