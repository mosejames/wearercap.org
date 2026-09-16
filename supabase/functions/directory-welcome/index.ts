// Sends the "your listing is live, come add more" email once, the first time a
// listing is published. Called by the client after a successful publish.
//
// It runs here rather than in the browser for two reasons: the address is the
// account email in auth.users, which the anon key cannot read, and the Resend
// key must never reach a browser. The caller's JWT is verified and the listing
// must belong to them, so signing in as one person cannot trigger mail about
// someone else's listing.
//
// welcome_sent_at makes it idempotent. The stamp is claimed atomically before
// sending, so two overlapping calls cannot both send. If Resend refuses, the
// claim is released so a later publish can try again.
//
// v1 never ran: its CORS preflight allowed only authorization and content-type,
// but supabase-js also sends apikey and x-client-info, so browsers dropped the
// POST after the OPTIONS. Keep these headers in step with event-confirm.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || '';
const MAIL_FROM = Deno.env.get('RESEND_FROM') || 'The RCAP Collective <hello@wearercap.org>';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function compose(name: string) {
  const url = 'https://wearercap.org/directory/';
  const text = [
    'Your listing is live on the RCAP Collective.',
    '',
    name + ' is now visible to RCA families at ' + url,
    '',
    'You published with the basics, which is exactly right. When you have a few',
    'minutes, sign back in and add the rest: photos of your work, a website or',
    'booking link, your social profiles, and whether you would mentor a student',
    'or speak on career day.',
    '',
    'Listings with photos get looked at. It takes about two minutes.',
    '',
    url,
    '',
    'Thank you for being part of this.',
    'RCAP',
  ].join('\n');

  const html = '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#14110f;max-width:520px">'
    + '<p style="font-size:20px;font-weight:800;margin:0 0 18px">Your listing is live.</p>'
    + '<p style="margin:0 0 16px"><strong>' + escape(name) + '</strong> is now visible to RCA families on the Collective.</p>'
    + '<p style="margin:0 0 16px">You published with the basics, which is exactly right. When you have a few minutes, sign back in and add the rest: photos of your work, a website or booking link, your social profiles, and whether you would mentor a student or speak on career day.</p>'
    + '<p style="margin:0 0 22px">Listings with photos get looked at. It takes about two minutes.</p>'
    + '<p style="margin:0 0 26px"><a href="' + url + '" style="background:#e8c578;color:#14110f;text-decoration:none;font-weight:800;padding:13px 22px;border-radius:8px;display:inline-block">Add more to your listing</a></p>'
    + '<p style="margin:0;color:#5a5350;font-size:14px">Thank you for being part of this.<br/>RCAP</p>'
    + '</div>';

  return { text, html };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST' });

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!token) return reply(401, { error: 'Sign in required' });

  let listingId = '';
  try {
    const parsed = await req.json();
    listingId = (parsed && parsed.listing_id) || '';
  } catch (_) {
    return reply(400, { error: 'Expected JSON' });
  }
  if (!listingId) return reply(400, { error: 'listing_id required' });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth || !auth.user || !auth.user.email) {
    return reply(401, { error: 'Sign in required' });
  }

  const { data: listing, error: listingError } = await db
    .from('directory_listings')
    .select('id, name, owner_id, published, welcome_sent_at')
    .eq('id', listingId)
    .maybeSingle();

  if (listingError) return reply(500, { error: 'Could not read the listing' });
  if (!listing) return reply(404, { error: 'No such listing' });
  // Owners trigger their own welcome. A directory admin may also send it, for
  // listings published before this function worked. Either way the email goes
  // to the listing owner's account address, never to the caller.
  let to = auth.user.email;
  if (listing.owner_id !== auth.user.id) {
    const { data: admin } = await db
      .from('directory_admins')
      .select('user_id')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (!admin) return reply(403, { error: 'Not your listing' });
    const { data: owner } = await db.auth.admin.getUserById(listing.owner_id);
    if (!owner?.user?.email) return reply(200, { sent: false, reason: 'owner has no email' });
    to = owner.user.email;
  }
  if (!listing.published) return reply(200, { sent: false, reason: 'not published' });
  if (listing.welcome_sent_at) return reply(200, { sent: false, reason: 'already sent' });
  if (!RESEND_KEY) {
    console.error('directory-welcome: RESEND_API_KEY is not set');
    return reply(200, { sent: false, reason: 'email not configured' });
  }

  // Claim the stamp first. Only one caller can move it from null.
  const { data: claimed, error: claimError } = await db
    .from('directory_listings')
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq('id', listing.id)
    .is('welcome_sent_at', null)
    .select('id');
  if (claimError) {
    console.error('directory-welcome: claim failed', claimError.message);
    return reply(500, { error: 'Could not record the welcome' });
  }
  if (!claimed || !claimed.length) return reply(200, { sent: false, reason: 'already sent' });

  const { text, html } = compose(listing.name || 'Your listing');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + RESEND_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to,
      subject: 'Your listing is live on the RCAP Collective',
      text,
      html,
    }),
  });

  if (!res.ok) {
    console.error('directory-welcome: Resend refused', res.status, await res.text());
    await db.from('directory_listings').update({ welcome_sent_at: null }).eq('id', listing.id);
    return reply(200, { sent: false, reason: 'send failed' });
  }

  console.log('directory-welcome: sent for listing', listing.id);
  return reply(200, { sent: true });
});
