import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/auth/AuthContext';
import { LogOut, Clock } from 'lucide-react';

interface AppShellProps { children: ReactNode }

/** Inline components for session UX */
export function SessionUI() {
  const { idleWarningListener, staySignedIn, signOut, authEnabled } = useAuth();
  const [idleWarning, setIdleWarning] = useState(false);

  useEffect(() => {
    if (!authEnabled) return;
    return idleWarningListener(setIdleWarning);
  }, [idleWarningListener, authEnabled]);

  /* "Signed out" confirmation toast — fires after any sign-out (REQ-A7). */
  const [signedOutToast, setSignedOutToast] = useState(false);
  useEffect(() => {
    const onSignedOut = () => {
      setSignedOutToast(true);
      window.setTimeout(() => setSignedOutToast(false), 5000);
    };
    window.addEventListener('cbe:signed-out', onSignedOut);
    return () => window.removeEventListener('cbe:signed-out', onSignedOut);
  }, []);

  if (!authEnabled) return null;

  return (
    <>
      {idleWarning && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="idle-title"
          aria-describedby="idle-desc"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 px-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6 text-center shadow-xl">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 mb-3">
              <Clock size={20} />
            </span>
            <h2 id="idle-title" className="text-lg font-bold text-gray-800 dark:text-white">Still there?</h2>
            <p id="idle-desc" className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
              You'll be signed out in 1 minute for security. Your saved work stays safe.
            </p>
            <div className="mt-4 flex gap-2 justify-center">
              <Button onClick={staySignedIn}>Keep working</Button>
              <Button variant="secondary" onClick={() => void signOut()}>
                <LogOut size={14} /> Sign out now
              </Button>
            </div>
          </div>
        </div>
      )}

      {signedOutToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium px-4 py-2 shadow-lg"
        >
          You're signed out. See you next time — your progress is safe.
        </div>
      )}
    </>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Skip-to-content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
