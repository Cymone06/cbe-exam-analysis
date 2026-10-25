import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/auth/AuthContext';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppShell, SessionUI } from '@/components/layout/AppShell';
import { Dashboard } from '@/pages/Dashboard';
import { ExamList } from '@/pages/ExamList';
import { ExamEntry } from '@/pages/ExamEntry';
import { ResultEntry } from '@/pages/ResultEntry';
import { Analysis } from '@/pages/Analysis';
import { GapDiagnosis } from '@/pages/GapDiagnosis';
import { ActionPlan } from '@/pages/ActionPlan';
import { ProgressComparison } from '@/pages/ProgressComparison';
import { Report } from '@/pages/Report';
import { Settings } from '@/pages/Settings';
import { MyLearners } from '@/pages/MyLearners';
import { Overview } from '@/pages/Overview';
import { Login } from '@/pages/auth/Login';
import { Signup } from '@/pages/auth/Signup';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { ResetPassword } from '@/pages/auth/ResetPassword';

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-3" role="status" aria-label="Loading" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading CBE Analysis...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { loading } = useApp();
  const { state } = useAuth();
  if (loading) return <LoadingScreen />;

  return (
    <>
      <SessionUI />
      <Routes>
      {/* Auth routes (no app shell) */}
      <Route path="/login" element={state.kind === 'signedOut' ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/signup" element={state.kind === 'signedOut' ? <Signup /> : <Navigate to="/" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected app shell */}
      <Route path="/*" element={
        <RequireAuth>
          <AppShell>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/learners" element={<MyLearners />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/exams" element={<ExamList />} />
              <Route path="/exams/new" element={<ExamEntry />} />
              <Route path="/exams/:id" element={<ExamEntry />} />
              <Route path="/exams/:id/results" element={<ResultEntry />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/gaps" element={<GapDiagnosis />} />
              <Route path="/plan" element={<ActionPlan />} />
              <Route path="/compare" element={<ProgressComparison />} />
              <Route path="/report" element={<Report />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </RequireAuth>
      } />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <HashRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AppRoutes />
    </HashRouter>
  );
}
