/**
 * Unit tests for the AuthService / DataRepository layer (REQ-T1, REQ-S2/REQ-S1)
 * with a mocked Supabase client — the UI only ever touches these interfaces.
 * Covers signup verification, generic errors (no email leakage), settings
 * saving and the realtime subscription contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* Mock the single Supabase client module before the services load. */
const mockClient = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    resend: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  },
  from: vi.fn(),
  functions: { invoke: vi.fn() },
  channel: vi.fn(),
  removeChannel: vi.fn(),
};
vi.mock('@/lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase')>();
  void actual;
  return {
    cloudEnabled: true,
    getSupabase: () => mockClient,
  };
});

const { SupabaseAuthService, AuthError } = await import('@/services/auth');
const { SupabaseDataRepository } = await import('@/services/dataRepository');
const { applyRemoteRow } = await import('@/services/syncEngine');

const sessionOf = (userId: string, email = 'u@example.test') => ({
  user: { id: userId, email, user_metadata: { display_name: 'Test' } },
});

describe('AuthService (mocked Supabase client)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('signUp reports when email verification is required (REQ-A1)', async () => {
    mockClient.auth.signUp.mockResolvedValue({ data: { user: sessionOf('u1'), session: null }, error: null });
    const svc = new SupabaseAuthService();
    const { needsVerification } = await svc.signUp('Test', 'u@example.test', 'Passw0rd!');
    expect(needsVerification).toBe(true);
    expect(mockClient.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'u@example.test', options: { data: { display_name: 'Test' } } }),
    );
  });

  it('signUp returns needsVerification=false when a session arrives immediately', async () => {
    mockClient.auth.signUp.mockResolvedValue({ data: { user: sessionOf('u1'), session: { user: sessionOf('u1').user } }, error: null });
    const svc = new SupabaseAuthService();
    expect((await svc.signUp('T', 'u@example.test', 'Passw0rd!')).needsVerification).toBe(false);
  });

  it('signIn errors are friendly and never reveal whether the email exists (REQ-A5)', async () => {
    mockClient.auth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'Invalid login credentials' } });
    const svc = new SupabaseAuthService();
    await expect(svc.signIn('who-knows@example.test', 'wrong')).rejects.toThrow('Invalid email or password.');
  });

  it('rate-limited attempts map to a friendly wait message (REQ-A5)', async () => {
    mockClient.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Rate limit exceeded' } });
    const svc = new SupabaseAuthService();
    await expect(svc.signIn('u@example.test', 'x')).rejects.toThrow('Too many attempts');
  });

  it('getSession maps the session into the flavoured shape', async () => {
    mockClient.auth.getSession.mockResolvedValue({ data: { session: sessionOf('u9') } });
    const svc = new SupabaseAuthService();
    const s = await svc.getSession();
    expect(s).toEqual({ userId: 'u9', email: 'u@example.test', displayName: 'Test' });
  });

  it('deleteAccount invokes the Edge Function and signs out (REQ-A6)', async () => {
    mockClient.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    mockClient.functions.invoke.mockResolvedValue({ data: { success: true }, error: null });
    mockClient.auth.signOut.mockResolvedValue({});
    const svc = new SupabaseAuthService();
    await svc.deleteAccount('u@example.test');
    expect(mockClient.functions.invoke).toHaveBeenCalledWith('delete-account', expect.objectContaining({ body: { confirmEmail: 'u@example.test' } }));
    expect(mockClient.auth.signOut).toHaveBeenCalled();
  });

  it('deleteAccount failure surfaces a friendly error without leaking details', async () => {
    mockClient.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    mockClient.functions.invoke.mockResolvedValue({ data: { error: 'nope' }, error: null });
    const svc = new SupabaseAuthService();
    await expect(svc.deleteAccount('u@example.test')).rejects.toThrow('Account deletion failed');
  });

  it('LocalAuthService (no project configured) keeps the app offline-capable', async () => {
    const { LocalAuthService } = await import('@/services/auth');
    const local = new LocalAuthService();
    expect(local.enabled).toBe(false);
    await expect(local.signIn('a@b.c', 'x')).rejects.toThrow(AuthError);
    expect(await local.getSession()).toBeNull();
    expect(local.onAuthChange(() => {})).toBeTypeOf('function');
  });
});

describe('DataRepository (mocked Supabase client)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pullAll reads every table filtered by user id and non-deleted rows', async () => {
    const repo = new SupabaseDataRepository();
    mockClient.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          is: async () => ({ data: [], error: null }),
        }),
      }),
    }));
    const rows = await repo.pullAll('u1');
    expect(Object.keys(rows)).toContain('learners');
    expect(Object.keys(rows)).toContain('user_settings');
  });

  it('upsert posts rows to the right table', async () => {
    const repo = new SupabaseDataRepository();
    const upsert = vi.fn(async () => ({ error: null }));
    mockClient.from.mockImplementation(() => ({ upsert }));
    await repo.upsert('learners', [{ id: 'l-1' }]);
    expect(mockClient.from).toHaveBeenCalledWith('learners');
    expect(upsert).toHaveBeenCalledWith([{ id: 'l-1' }]);
  });

  it('softDelete stamps deleted_at on the given ids (REQ-SY2)', async () => {
    const repo = new SupabaseDataRepository();
    const update = vi.fn(() => ({ in: async () => ({ error: null }) }));
    mockClient.from.mockImplementation(() => ({ update }));
    await repo.softDelete('exams', ['e-1']);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(String) }));
  });

  it('subscribe registers per-table realtime handlers and returns an unsubscribe', async () => {
    const repo = new SupabaseDataRepository();
    const handler = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    };
    mockClient.channel.mockReturnValue(handler);
    mockClient.removeChannel.mockResolvedValue(undefined);
    const off = repo.subscribe('u1', () => {});
    expect(off).toBeTypeOf('function');
    // 11 tables get a postgres_changes binding each
    expect(handler.on.mock.calls.length).toBeGreaterThanOrEqual(11);
    off();
    expect(mockClient.removeChannel).toHaveBeenCalled();
  });

  it('saveSettings upserts the settings JSON document', async () => {
    const repo = new SupabaseDataRepository();
    const upsert = vi.fn(async () => ({ error: null }));
    mockClient.from.mockImplementation(() => ({ upsert }));
    await repo.saveSettings('u1', { theme: 'dark' });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', data: { theme: 'dark' } }));
  });
});

/* Sanity: the pure sync engine stays importable alongside the mocked services. */
describe('service-layer test scaffolding', () => {
  it('imports cleanly', () => {
    expect(applyRemoteRow).toBeTypeOf('function');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
