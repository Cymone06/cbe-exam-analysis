/** Shared card layout for all auth screens (friendly, a11y-first). */
import type { ReactNode } from 'react';
import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AuthLayout({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white mb-3">
            <GraduationCap size={26} />
          </span>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">CBE Exam Analysis</h1>
          <h2 className="mt-2 text-lg font-semibold text-gray-700 dark:text-gray-200">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-gray-400 text-center">
          Every step forward counts.{' '}
          <Link to="/login" className="underline hover:text-indigo-500">Back to login</Link>
        </p>
      </div>
    </div>
  );
}

/** Auth error paragraph with aria-describedby-friendly id. */
export function AuthErrorBox({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-red-600 dark:text-red-400 mb-2">
      {message}
    </p>
  );
}
