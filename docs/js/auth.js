// ── Supabase Auth ─────────────────────────────────────────────────────────────
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://axlybeznzibovvqkllzq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dN_eqVSKcdgwZCb1QEyHkA_vnmF7qS0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function signOut() {
  return supabase.auth.signOut();
}
