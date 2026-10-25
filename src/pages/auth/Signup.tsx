import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, User as UserIcon } from 'lucide-react';
import { AuthLayout, AuthErrorBox } from '@/components/auth/AuthLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PasswordField } from '@/components/auth/PasswordField';
import { useAuth } from '@/auth/AuthContext';
import { AuthError } from '@/services/auth';

/**
 * Sign up (REQ-A1): display name + email + password (min 8 with strength meter).
 * On success → friendly "Check your email" screen (REQ-A1) when verification
 * is required, else straight to the app.
 */
export function Signup() {
  const { signUp, authEnabled } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!authEnabled) { setError('Cloud accounts are not configured in this build — the app works offline without one.'); return; }
    if (!displayName.trim()) { setError('Please enter your name.'); return; }
    if (!email.trim()) { setError('Please enter your email.'); return; }
    if (password.length < 8) { setError('Your password needs at least 8 characters.'); return; }
    setBusy(true);
    try {
      const { needsVerification } = await signUp(displayName.trim(), email.trim(), password);
      if (needsVerification) setSentTo(email.trim());
      else window.location.hash = '#/';
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Track every learner's progress — online or off.">
      <form onSubmit={submit} noValidate>
        <AuthErrorBox id="signup-error" message={error} />
        <div className="space-y-3">
          <Input
            id="signup-name" label="Your name" autoComplete="name"
            value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            leftIcon={<UserIcon size={15} />} placeholder="Ms. Okafor" required
            aria-describedby="signup-error"
          />
          <Input
            id="signup-email" label="Email" type="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={15} />} placeholder="you@example.com" required
            aria-describedby="signup-error"
          />
          <PasswordField
            id="signup-password"
            label="Password"
            value={password}
            onChange={setPassword}
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full mt-5">
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-center text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Sign in</Link>
      </p>

      {sentTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 flex items-center justify-center mb-3">
              <Mail size={22} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Check your email</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              We sent a verification link to <strong>{sentTo}</strong>. Click it to activate your account, then sign in.
            </p>
            <ResendRow email={sentTo} />
            <Link to="/login" className="inline-block mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

export function ResendRow({ email }: { email: string }) {
  const { resendVerification, authEnabled } = useAuth();
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');

  const resend = async () => {
    if (!authEnabled) { setState('error'); return; }
    setState('busy');
    try {
      await resendVerification(email);
      setState('sent');
    } catch {
      setState('error');
    }
  };

  if (state === 'sent') {
    return <p className="mt-3 text-sm text-green-600 dark:text-green-400">Verification email sent again — check your inbox.</p>;
  }
  if (state === 'error') {
    return <p className="mt-3 text-sm text-red-600 dark:text-red-400">Couldn't send it right now — please try again in a few minutes.</p>;
  }
  return (
    <button
      type="button"
      onClick={resend}
      disabled={state === 'busy'}
      className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
    >
      {state === 'busy' ? 'Sending…' : "Didn't get it? Resend the email"}
    </button>
  );
}
