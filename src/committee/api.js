import { supabase } from '../carpool/supabaseClient.js';

/* Progressive save.

   A parent who gives us a name and an email and then closes the tab is still a
   lead worth having, so we write as soon as we have those two and patch the
   same row on every step after. The row is keyed by a random token held in this
   browser, not by anything guessable, and every write goes through
   committee_interest_save — a security-definer function. The table itself has
   no policies and no grants, so the anon key cannot read, update or delete a
   row even if someone lifts it out of the bundle.

   Saves are fire-and-forget on purpose: a parent should never be blocked
   mid-flow by a network hiccup. The final submit is the one that is awaited and
   reported, because that is the one they are told succeeded. */

const KEY = 'rcap_ci_token';

export function getToken() {
  let t = null;
  try {
    t = localStorage.getItem(KEY);
  } catch {
    /* Safari private mode and friends. An in-memory token still works for the
       length of the session, which is all a single sitting needs. */
  }
  if (!t) {
    t = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
    try { localStorage.setItem(KEY, t); } catch { /* no-op */ }
  }
  return t;
}

export function clearToken() {
  try { localStorage.removeItem(KEY); } catch { /* no-op */ }
}

async function call(token, patch) {
  const { error } = await supabase.rpc('committee_interest_save', {
    p_token: token,
    p_patch: patch,
  });
  if (error) throw error;
}

/** Best-effort mid-flow save. Never throws, never blocks the parent. */
export function saveQuiet(token, patch) {
  call(token, patch).catch((e) => console.warn('interim save failed', e));
}

/** The final submit. Throws so the caller can show a real error. */
export async function submit(token, patch) {
  await call(token, { ...patch, status: 'complete' });
}
