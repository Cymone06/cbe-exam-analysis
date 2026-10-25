// ══════════════════════════════════════════════════════════════════════════════
// Edge Function: delete-account  (REQ-A6)
// Permanently deletes the calling user's account — the service-role key is
// held ONLY here, server-side. The caller must confirm by passing their email.
//
// Deploy (see README §6):
//   supabase functions deploy delete-account --no-verify-jwt=false
//
// The frontend calls it with the user's access token; Supabase verifies the
// JWT, then we re-check the confirmed email before touching auth.admin.
// ══════════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  try {
    const { confirmEmail } = await req.json();
    if (typeof confirmEmail !== 'string' || !confirmEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Type your email exactly as you signed up to confirm.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Resolve the caller from their Authorization: Bearer <jwt> header.
    //    createClient with the user JWT + anon key validates the token.
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Your session has expired. Please sign in again.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }
    const user = userData.user;

    // 2. The typed email must match the account email exactly (case-insensitive).
    if (confirmEmail.trim().toLowerCase() !== (user.email ?? '').toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'The email you typed does not match this account.' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Service-role client (key stays inside this function, never the browser)
    //    deletes the user; FK `on delete cascade` wipes every learner row.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error('delete-account failed:', delErr.message);
      return new Response(
        JSON.stringify({ error: 'Account deletion failed. Please try again.' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('delete-account error:', err);
    return new Response(
      JSON.stringify({ error: 'Account deletion failed. Please try again.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
