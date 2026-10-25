import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { AuthLayout, AuthErrorBox } from '@/components/auth/AuthLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/auth/AuthContext';
import { AuthError } from '@/services/auth';

/**
 * Login (REQ-A2, REQ-A5): generic errors, keep-signed-in option, and
 * return-to-page redirect handled from the `from` navigation state.
 */
export function Login() {
  const { signIn, authEnabled } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!authEnabled) { setError('Cloud accounts are not configured in this build — the app works offline without one.'); return; }
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate(fromState ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to keep your learners' progress safe in the cloud.">
      <form onSubmit={submit} noValidate>
        <AuthErrorBox id="login-error" message={error} />
        <div className="space-y-3">
          <Input
            id="login-email" label="Email" type="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={15} />} placeholder="you@example.com" required
            aria-describedby="login-error"
          />
          <Input
            id="login-password" label="Password" type="password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock size={15} />} placeholder="••••••••" required
          />
        </div>
        <div className="flex items-center justify-between mt-3 text-sm">
          <label className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <input
              type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              aria-label="Keep me signed in on this device"
            />
            Keep me signed in on this device
          </label>
          <Link to="/forgot-password" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" disabled={busy} className="w-full mt-5">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-center text-gray-500 dark:text-gray-400">
        New here?{' '}
        <Link to="/signup" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
