import { useState, type FormEvent } from 'react';
import { AuthLayout, AuthErrorBox } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { PasswordField } from '@/components/auth/PasswordField';
import { useAuth } from '@/auth/AuthContext';
import { AuthError } from '@/services/auth';

/**
 * /reset-password — handles the recovery link (REQ-A2). Supabase redirects
 * here with a recovery token in the URL; supabase-js picks it up
 * (detectSessionInUrl) so the new password can be set directly.
 */
export function ResetPassword() {
  const { updatePassword, authEnabled } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!authEnabled) { setError('Cloud accounts are not configured in this build.'); return; }
    if (password.length < 8) { setError('Your password needs at least 8 characters.'); return; }
    setBusy(true);
    try {
      await updatePassword(password);
      window.location.hash = '#/login';
    } catch (err) {
      if (err instanceof AuthError) setError(err.message);
      else setError('This reset link may have expired — start the "Forgot password" flow again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password" subtitle="Enter your new password below — then sign in with it.">
      <form onSubmit={submit} noValidate>
        <AuthErrorBox id="reset-error" message={error} />
        <PasswordField id="reset-password" label="New password" value={password} onChange={setPassword} />
        <Button type="submit" disabled={busy} className="w-full mt-4">
          {busy ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
