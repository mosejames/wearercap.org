// The builder shares the playbook's Supabase session, so an officer already
// signed in to the Living Playbook is already signed in here.
import { supabase } from '../playbook/api.js';
import { prepareImage } from '../vault/images.js';
export { supabase };

export async function call(action, payload = {}) {
  const { data, error } = await supabase.rpc('rcap_newsletter', { p_action: action, p_payload: payload });
  if (error) throw new Error(error.message);
  return data;
}

// Resize on the phone, then put one email-sized JPEG in shared R2 storage.
export async function uploadPhoto(issueId, file) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to add photos.');
  const prepared = await prepareImage(file);
  const id = crypto.randomUUID();
  const r = await fetch('/api/newsletter-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ issueId, files: [{ id }] }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Could not add that photo. Try again, or paste an image link.');
  const item = body.items?.[0];
  const put = await fetch(item.url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: prepared.web });
  if (!put.ok) throw new Error('The photo did not finish uploading. Please try again.');
  return `${body.publicBase}/${item.key}`;
}
