import { useState, useRef, useEffect } from 'react';
import { Moon, Sun, LogOut } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/auth/AuthContext';
import { LearnerSwitcher, learnerInitials } from '@/components/learners/LearnerSwitcher';
import { SyncIndicator } from '@/components/learners/SyncIndicator';
import { Button } from '@/components/ui/Button';

export function TopBar() {
  const { state, dispatch } = useApp();
  const { user, signOut } = useAuth();
  const { settings } = state;
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const toggleTheme = () => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { theme: settings.theme === 'dark' ? 'light' : 'dark' } });
  };

  return (
    <header ref={rootRef} className="h-14 flex items-center justify-between px-3 md:px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0 gap-2">
      {/* Mobile brand */}
      <span className="md:hidden text-lg font-bold text-indigo-600 dark:text-indigo-400 shrink-0">CBE Analysis</span>

      {/* Learner switcher — always visible (REQ-ML3) */}
      <div className="min-w-0 flex items-center gap-1">
        <LearnerSwitcher />
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <SyncIndicator />
        <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle dark mode">
          {settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </Button>

        {/* Account menu: logout in header + mobile (REQ-A2) */}
        {user && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
              style={{ backgroundColor: '#6366f1' }}
            >
              {learnerInitials(user.displayName ?? user.email ?? 'U')}
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-1 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-50 py-1" aria-label="Account">
                <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 truncate" aria-hidden="true">
                  Signed in as <span className="font-medium">{user.email ?? user.displayName}</span>
                </p>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => { setMenuOpen(false); void signOut(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
