import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

/**
 * Route protection (REQ-A4): unauthenticated users go to /login and are
 * returned to the page they wanted after signing in. Expired sessions land
 * on the same redirect.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.kind === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" role="status" aria-label="Checking your session" />
      </div>
    );
  }
  if (state.kind === 'signedOut') {
    const from = location.pathname === '/' ? undefined : location.pathname;
    return <Navigate to="/login" state={from ? { from } : undefined} replace />;
  }
  return children;
}
