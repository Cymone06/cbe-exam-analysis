/**
 * AuthContext — session state, idle auto-logout and signed-out cleanup.
 * Wraps AuthService so the UI never touches Supabase directly (REQ-S2).
 * When no Supabase project is configured the app runs as a signed-out
 * "local" user and everything keeps working offline.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { authService, AuthError, type FlavouredSession } from '@/services/auth';
import { getSupabase, cloudEnabled } from '@/lib/supabase';
import { loadAccountDoc, saveAccountDoc, clearAccount } from '@/store/db';
import type { AppSettings } from '@/types';

export type AuthState =
  | { kind: 'loading' }
  | { kind: 'local' }                       // no Supabase project configured
  | { kind: 'signedOut' }                   // project configured, user not signed in
  | { kind: 'signedIn'; session: FlavouredSession };

type IdleWarningListener = (active: boolean) => void;

interface AuthContextValue {
  state: AuthState;
  user: FlavouredSession | null;
  /** The account id for the local cache — 'local' when not signed in. */
  accountId: string;
  authEnabled: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(displayName: string, email: string, password: string): Promise<{ needsVerification: boolean }>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  resendVerification(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  updateEmail(email: string): Promise<void>;
  deleteAccount(confirmEmail: string): Promise<void>;
  /** Idle auto-logout countdown — listeners receive `true` when the "1 minute left" modal must show. */
  idleWarningListener(listener: IdleWarningListener): () => void;
  /** Cancel the pending idle sign-out ("Keep working" button on the warning modal). */
  staySignedIn(): void;
  /** Persist the "Keep me signed in on this device" choice (REQ-A3). */
  setKeepSignedIn(enabled: boolean): void;
  /** Read cached account settings (used for the idle-logout configuration). */
  loadCachedSettings(userId: string): Promise<AppSettings | null>;
}

const SESSION_SCOPE_KEY = 'cbe-session-scoped'; // sessionStorage marker for "keep me signed in" opt-out
const KEEP_KEY = 'cbe-keep-signed-in';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ kind: 'loading' });
  const idleListeners = useRef(new Set<IdleWarningListener>());
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitIdle = (active: boolean) => {
    idleListeners.current.forEach((l) => l(active));
  };

  // ── Boot: hydrate the session ──────────────────────────────────────────────
  useEffect(() => {
    if (!cloudEnabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time boot decision, not a subscription
      setState({ kind: 'local' });
      return;
    }
    let unsub: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      const session = await authService.getSession();
      if (cancelled) return;
      if (session) {
        // "Keep me signed in" opt-out: when unticked, the session is scoped to
        // this browser tab and is dropped on a cold launch (REQ-A3).
        const keep = localStorage.getItem(KEEP_KEY) !== 'false';
        const scoped = sessionStorage.getItem(SESSION_SCOPE_KEY) === '1';
        if (keep || scoped) {
          setState({ kind: 'signedIn', session });
        } else {
          await authService.signOut();
          setState({ kind: 'signedOut' });
        }
      } else {
        setState({ kind: 'signedOut' });
      }
      unsub = authService.onAuthChange((e) => {
        if (cancelled) return;
        if (e.event === 'SIGNED_IN' || e.event === 'TOKEN_REFRESHED') {
          sessionStorage.removeItem(SESSION_SCOPE_KEY);
          setState((prev) =>
            prev.kind === 'signedIn' ? prev : { kind: 'signedIn', session: e.session },
          );
        } else if (e.event === 'SIGNED_OUT') {
          setState({ kind: 'signedOut' });
        }
      });
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // ── Idle auto-logout (REQ-A3): default 30 min, warning 1 minute before ─────
  const userId = state.kind === 'signedIn' ? state.session.userId : null;
  useEffect(() => {
    if (!userId) {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      emitIdle(false);
      return;
    }
    let expired = false;
    let warned = false;
    let minutes = 30;
    void loadCachedSettings(userId).then((s) => {
      if (s && typeof s.idleLogoutMinutes === 'number') minutes = s.idleLogoutMinutes;
      arm();
    });

    const warn = () => {
      if (!warned && !expired) {
        warned = true;
        emitIdle(true);
        idleTimer.current = setTimeout(() => {
          expired = true;
          emitIdle(false);
          void authService.signOut();
        }, 60_000);
      }
    };
    const arm = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      emitIdle(false);
      if (!minutes || minutes <= 0) return;
      idleTimer.current = setTimeout(warn, minutes * 60_000);
    };
    const bump = () => { if (!warned && !expired) arm(); };
    /** "Keep working" button: fully cancels the warning and re-arms. */
    const stayActive = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      warned = false;
      expired = false;
      emitIdle(false);
      arm();
    };
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
    window.addEventListener('cbe:stay-active', stayActive);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump));
      window.removeEventListener('cbe:stay-active', stayActive);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      emitIdle(false);
    };
     
  }, [userId]);

  async function loadCachedSettings(id: string): Promise<AppSettings | null> {
    const doc = await loadAccountDoc(id);
    return doc?.settings ?? null;
  }

  const api = useMemo<AuthContextValue>(() => ({
    state,
    user: state.kind === 'signedIn' ? state.session : null,
    accountId: state.kind === 'signedIn' ? state.session.userId : 'local',
    authEnabled: getSupabase() !== null,
    async signIn(email, password) { await authService.signIn(email, password); },
    async signUp(displayName, email, password) { return authService.signUp(displayName, email, password); },
    async signOut() {
      // Clear the local offline cache for this account, then sign out (REQ-A7).
      if (userId) await clearAccount(userId);
      await authService.signOut();
      emitIdle(false);
      setState({ kind: cloudEnabled ? 'signedOut' : 'local' });
      window.dispatchEvent(new CustomEvent('cbe:signed-out'));
    },
    async sendPasswordReset(email) { await authService.sendPasswordReset(email); },
    async resendVerification(email) { await authService.resendVerification(email); },
    async updatePassword(password) { await authService.updatePassword(password); },
    async updateEmail(email) { await authService.updateEmail(email); },
    async deleteAccount(confirmEmail) { await authService.deleteAccount(confirmEmail); },
    idleWarningListener(listener) {
      idleListeners.current.add(listener);
      return () => { idleListeners.current.delete(listener); };
    },
    staySignedIn() { window.dispatchEvent(new Event('cbe:stay-active')); },
    setKeepSignedIn(enabled) {
      localStorage.setItem(KEEP_KEY, String(enabled));
      if (!enabled) sessionStorage.setItem(SESSION_SCOPE_KEY, '1');
      else sessionStorage.removeItem(SESSION_SCOPE_KEY);
      void loadAccountDoc(userId ?? 'local').then((doc) => {
        if (doc) void saveAccountDoc(userId ?? 'local', { ...doc, settings: { ...doc.settings, keepSignedIn: enabled } });
      });
    },
    loadCachedSettings,
  }), [state, userId]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export { AuthError };
