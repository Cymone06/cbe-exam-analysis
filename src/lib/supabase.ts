/**
 * Single Supabase client module (REQ-S1, REQ-S2).
 * Reads the publishable (anon) key from env vars only — never a service-role
 * or secret key. When the env vars are missing (local/demo mode without a
 * project), it exports `null` and every feature degrades to local-only mode.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True when a Supabase project is configured for this build. */
export const cloudEnabled = Boolean(url && key);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!cloudEnabled) return null;
  if (!client) {
    client = createClient(url as string, key as string, {
      auth: {
        // Token refresh handled by supabase-js; persistence follows the
        // "Keep me signed in" setting (see AuthService) — with storageKey per app.
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'cbe-auth',
      },
      realtime: {
        params: { eventsPerSecond: 5 },
      },
    });
  }
  return client;
}
