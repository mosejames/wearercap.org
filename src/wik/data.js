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
export async function addPost({ kind, topic, headline, body, authorName, relation, gradClass, answersTo = null }) {
  const row = {
    round_slug: CURRENT.slug,
    kind,
    answers_to: answersTo,
    topic,
    headline: headline.trim(),
    body: (body || '').trim(),
    author_name: (authorName || '').trim(),
    relation,
    grad_class: gradClass,
  };
  const { error } = await supabase.from(TABLE).insert(row);
  if (error) throw error;
  return fromRow({ ...row, id: null, status: 'pending', created_at: new Date().toISOString() });
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
