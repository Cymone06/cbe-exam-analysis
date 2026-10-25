import { useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { AuthLayout, AuthErrorBox } from '@/components/auth/AuthLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/auth/AuthContext';
import { AuthError } from '@/services/auth';

/**
 * Forgot password (REQ-A2 / REQ-A5): always answers the same friendly
 * message whether or not the email exists.
 */
export function ForgotPassword() {
  const { sendPasswordReset, authEnabled } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!authEnabled) { setError('Cloud accounts are not configured in this build.'); return; }
    if (!email.trim()) { setError('Please enter your email.'); return; }
    setBusy(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a secure reset link.">
      <form onSubmit={submit} noValidate>
        <AuthErrorBox id="forgot-error" message={error} />
        <Input
          id="forgot-email" label="Email" type="email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail size={15} />} placeholder="you@example.com" required
          aria-describedby="forgot-error"
        />
        <Button type="submit" disabled={busy} className="w-full mt-4">
          {busy ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      {sent && (
        <p role="status" className="mt-4 text-sm text-green-700 dark:text-green-400">
          If that email has an account, a reset link is on its way — check your inbox.
        </p>
      )}
    </AuthLayout>
  );
}
