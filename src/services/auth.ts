/**
 * AuthService — authentication operations behind an interface (REQ-S2).
 * The UI only talks to this interface, never to supabase-js directly.
 * A no-op LocalAuthService keeps the app fully usable without a Supabase
 * project (offline/demo mode).
 */
import { getSupabase, cloudEnabled } from '@/lib/supabase';

export interface FlavouredSession {
  userId: string;
  email: string | null;
  displayName: string | null;
}

/** Friendly error text for an auth failure — never reveals whether an email exists. */
export class AuthError extends Error {}

type AuthEvent =
  | { event: 'SIGNED_IN'; session: FlavouredSession }
  | { event: 'SIGNED_OUT' }
  | { event: 'TOKEN_REFRESHED'; session: FlavouredSession };

export interface AuthService {
  readonly enabled: boolean;
  /** Sign up with display name + email + password. Returns whether email verification is needed. */
  signUp(displayName: string, email: string, password: string): Promise<{ needsVerification: boolean }>;
  signIn(email: string, password: string): Promise<FlavouredSession>;
  signOut(): Promise<void>;
  /** Re-send the verification email (for the "Check your email" screen). */
  resendVerification(email: string): Promise<void>;
  /** Send a password-reset email. Same generic response whether or not the email exists. */
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  updateEmail(email: string): Promise<void>;
  /** Permanently delete the account via the server-side Edge Function (REQ-A6). */
  deleteAccount(confirmEmail: string): Promise<void>;
  getSession(): Promise<FlavouredSession | null>;
  onAuthChange(listener: (e: AuthEvent) => void): () => void;
}

/* ─── Supabase implementation ──────────────────────────────────────────────── */

/** Maps a supabase error to a friendly, non-revealing message. */
function friendlyAuthMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('too many') || m.includes('429')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (m.includes('invalid login credentials') || m.includes('signin')) {
    return 'Invalid email or password.';
  }
  if (m.includes('password')) {
    return 'Please check your password and try again.';
  }
  return 'Something went wrong. Please check your connection and try again.';
}

export class SupabaseAuthService implements AuthService {
  readonly enabled = true;

  private flavoured(session: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } }): FlavouredSession {
    const md = session.user.user_metadata ?? {};
    return {
      userId: session.user.id,
      email: session.user.email ?? null,
      displayName: typeof md.display_name === 'string' ? md.display_name : null,
    };
  }

  async signUp(displayName: string, email: string, password: string) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw new AuthError(friendlyAuthMessage(error.message));
    return { needsVerification: !data.session };
  }

  async signIn(email: string, password: string) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new AuthError(friendlyAuthMessage(error.message));
    return this.flavoured(data);
  }

  async signOut() {
    await getSupabase()!.auth.signOut();
  }

  async resendVerification(email: string) {
    const supabase = getSupabase()!;
    const { error } = await supabase.auth.resend({ email, type: 'signup' });
    if (error) throw new AuthError(friendlyAuthMessage(error.message));
  }

  async sendPasswordReset(email: string) {
    const supabase = getSupabase()!;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}#/reset-password`,
    });
    if (error) throw new AuthError(friendlyAuthMessage(error.message));
  }

  async updatePassword(password: string) {
    const supabase = getSupabase()!;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new AuthError(friendlyAuthMessage(error.message));
  }

  async updateEmail(email: string) {
    const supabase = getSupabase()!;
    const { error } = await supabase.auth.updateUser({ email });
    if (error) throw new AuthError(friendlyAuthMessage(error.message));
  }

  async deleteAccount(confirmEmail: string) {
    const supabase = getSupabase()!;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new AuthError('Your session has expired. Please sign in again and retry.');
    const { error, data } = await supabase.functions.invoke('delete-account', {
      body: { confirmEmail },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error || (data && data.error)) {
      throw new AuthError('Account deletion failed. Please try again or contact support.');
    }
    await supabase.auth.signOut();
  }

  async getSession() {
    const supabase = getSupabase()!;
    const { data: { session } } = await supabase.auth.getSession();
    return session ? this.flavoured(session) : null;
  }

  onAuthChange(listener: (e: AuthEvent) => void) {
    const supabase = getSupabase()!;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        listener({ event: 'SIGNED_IN', session: this.flavoured(session) });
      } else if (event === 'SIGNED_OUT') {
        listener({ event: 'SIGNED_OUT' });
      } else if (event === 'TOKEN_REFRESHED' && session) {
        listener({ event: 'TOKEN_REFRESHED', session: this.flavoured(session) });
      }
    });
    return () => data.subscription.unsubscribe();
  }
}

/* ─── Local (no-project) implementation: the app runs fully offline ────────── */

export class LocalAuthService implements AuthService {
  readonly enabled = false;
  async signUp(): Promise<{ needsVerification: boolean }> { throw new AuthError('Cloud accounts are not configured in this build. The app works fully offline.'); }
  async signIn(_email: string, _password: string): Promise<FlavouredSession> { throw new AuthError('Cloud accounts are not configured in this build. The app works fully offline.'); }
  async signOut(): Promise<void> {}
  async resendVerification(_email: string): Promise<void> {}
  async sendPasswordReset(_email: string): Promise<void> {}
  async updatePassword(_password: string): Promise<void> {}
  async updateEmail(_email: string): Promise<void> {}
  async deleteAccount(_confirmEmail: string): Promise<void> {}
  async getSession(): Promise<FlavouredSession | null> { return null; }
  onAuthChange(_listener: (e: never) => void): () => void { return () => {}; }
}

export const authService: AuthService =
  cloudEnabled ? new SupabaseAuthService() : new LocalAuthService();
