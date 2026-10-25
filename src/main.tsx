import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@/auth/AuthContext';
import { AppProvider, useApp } from '@/store/AppContext';
import App from './App';
import './index.css';

/** Boot gate: keeps the existing loading screen while rehydration runs
 *  (AuthProvider resolves the session, AppProvider loads the account cache). */
function BootFallback() {
  const { loading } = useApp();
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-3" role="status" aria-label="Loading" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading CBE Analysis...</p>
        </div>
      </div>
    );
  }
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppProvider>
        <BootFallback />
      </AppProvider>
    </AuthProvider>
  </StrictMode>,
);

// Register the service worker for offline-first behaviour (production only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
