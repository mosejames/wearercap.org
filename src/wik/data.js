import { supabase } from '../carpool/supabaseClient.js';
import { CURRENT } from './config.js';

const TABLE = 'wik_posts';

const fromRow = (r) => ({
  id: r.id,
  round: r.round_slug,
  kind: r.kind,
  answersTo: r.answers_to,
  topic: r.topic,
  headline: r.headline,
  body: r.body || '',
  prompt: r.prompt || '',
  authorName: r.author_name || '',
  relation: r.relation,
  gradClass: r.grad_class,
  status: r.status,
  createdAt: r.created_at,
});

// The public read. Row-level security already restricts this to approved rows,
// so there is no client-side filter to forget — an unapproved post simply is
// not in the response.
export async function listPublic(slug = CURRENT.slug) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('round_slug', slug)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

// One insert path for all three kinds. `status` is never sent: the column
// defaults to 'pending' and the insert policy refuses anything else.
//
// Note the missing .select(). It is missing on purpose. PostgREST turns
// .select() into INSERT ... RETURNING, and RETURNING requires the new row to
// be visible under the SELECT policy — which for a pending row it is not, by
// design. Adding .select() back here fails every submission with a misleading
// "violates row-level security policy" error. The row is echoed from what we
// sent instead; the caller only needs it to render the thank-you card.
export async function addPost({ kind, topic, headline, body, authorName, relation, gradClass, prompt = '', answersTo = null }) {
  const row = {
    // Generated here rather than in the database so the browser knows which
    // row is its own. It has to: the read policy hides pending rows, so there
    // is no way to look up "the thing I just wrote" after the fact.
    id: crypto.randomUUID(),
    round_slug: CURRENT.slug,
    kind,
    answers_to: answersTo,
    topic,
    headline: headline.trim(),
    body: (body || '').trim(),
    author_name: (authorName || '').trim(),
    relation,
    grad_class: gradClass,
    prompt: (prompt || '').trim(),
  };
  const { error } = await supabase.from(TABLE).insert(row);
  if (error) throw error;
  return fromRow({ ...row, status: 'pending', created_at: new Date().toISOString() });
}

// Did it go live? The screen runs within a couple of seconds of the insert and
// publishes anything clearly fine. We find out the honest way: ask for the row
// by id. The read policy returns approved rows only, so the row coming back at
// all IS the confirmation that it published — there is no status to leak and
// no new endpoint to secure.
//
// Resolves true the moment it appears, false if the window closes first. False
// is not a failure: it means a person is going to look at it.
export async function waitForPublish(id, { timeoutMs = 12000, everyMs = 1500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, everyMs));
    try {
      const { data } = await supabase.from(TABLE).select('id').eq('id', id).maybeSingle();
      if (data?.id) return true;
    } catch { /* a blip mid-poll should not end the wait */ }
  }
  return false;
}

/* ------------------------------------------------------------- back office */

export async function adminAll(passcode) {
  const { data, error } = await supabase.rpc('wik_admin_all', { p_pass: passcode });
  if (error) throw new Error(error.message || 'Could not load.');
  return (data || []).map(fromRow);
}

export async function setStatus(id, status, passcode) {
  const { error } = await supabase.rpc('wik_set_status', {
    p_id: id, p_status: status, p_pass: passcode,
  });
  if (error) throw new Error(error.message || 'Could not update.');
}

// Declining a question should take its answers with it — an answer with no
// visible question reads as a non-sequitur on the board.
export async function declineThread(id, passcode) {
  const { error } = await supabase.rpc('wik_decline_thread', { p_id: id, p_pass: passcode });
  if (error) throw new Error(error.message || 'Could not update.');
}
