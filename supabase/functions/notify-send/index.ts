// notify-send — texts go out the moment they're queued.
//
// A Postgres trigger calls this the instant a row lands in ue_notifications,
// so a bin holder hears about a request in seconds, not up to an hour later.
// The same endpoint doubles as a sweeper (?drain=1) that retries anything
// still pending, which is the safety net if a single call ever fails.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const FROM = Deno.env.get('TWILIO_FROM') || '';
const MSG_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') || '';
const SECRET = Deno.env.get('NOTIFY_SECRET') || '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || '';
const MAIL_FROM = Deno.env.get('RESEND_FROM') || 'RCAP Uniform Exchange <hello@wearercap.org>';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

import { asHtml, asText } from './email.ts';

async function sendEmail(row: { to: string; subject: string; body: string }) {
  if (!RESEND_KEY) return { ok: false, detail: 'Email not configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [row.to],
        subject: row.subject || 'RCAP Uniform Exchange',
        text: asText(row.body),
        html: asHtml(row.subject || '', row.body),
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, detail: `${res.status} ${j?.message || ''}`.slice(0, 180) };
    return { ok: true, detail: j?.id || '' };
  } catch (e) {
    return { ok: false, detail: String(e).slice(0, 180) };
  }
}

async function sendOne(row: { id: string; phone: string; body: string }) {
  if (!SID || !TOKEN || (!FROM && !MSG_SID)) {
    return { ok: false, detail: 'Twilio not configured' };
  }
  const form = new URLSearchParams({ To: row.phone, Body: row.body });
  if (MSG_SID) form.set('MessagingServiceSid', MSG_SID);
  else form.set('From', FROM);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${SID}:${TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, detail: `${res.status} ${j?.message || ''}`.slice(0, 180) };
    return { ok: true, detail: j?.sid || '' };
  } catch (e) {
    return { ok: false, detail: String(e).slice(0, 180) };
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  let payload: Record<string, unknown> = {};
  if (req.method === 'POST') payload = await req.json().catch(() => ({}));

  const secret = req.headers.get('x-ue-secret') || url.searchParams.get('secret') || '';
  if (!SECRET || secret !== SECRET) {
    return new Response(JSON.stringify({ error: 'nope' }), { status: 403 });
  }

  const id = (payload.id as string) || url.searchParams.get('id') || '';
  const sel = 'id,phone,body,attempts,channel,email,subject';

  type Row = {
    id: string; phone: string; body: string; attempts?: number;
    channel?: string; email?: string; subject?: string;
  };
  let rows: Row[] = [];
  if (id) {
    const { data, error } = await db.from('ue_notifications').select(sel).eq('id', id).eq('status', 'pending');
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    rows = data || [];
  } else {
    // Sweep time is also when the day's held messages get rolled into one
    // round-up for the holders who asked for that.
    await db.rpc('ue_send_digests').catch(() => {});
    // And a fortnightly poke for a holder sitting on a quiet bin. Guarded
    // server-side, so calling it every sweep is harmless.
    await db.rpc('ue_nudge_holders').catch(() => {});
    // The evening before a handoff nobody has confirmed, one reminder to the
    // holder. Only fires 5–9pm Atlanta time and once per bag.
    await db.rpc('ue_nudge_unconfirmed').catch(() => {});
    // Families rarely tap "Got it". A bag that left a holder's hands days ago
    // and hasn't been disputed is done.
    await db.rpc('ue_autoclose_handoffs').catch(() => {});

    // Everything still pending and actually due, plus recent failures worth
    // another go. After a day, or three tries, we stop rattling a bad number.
    const now = new Date().toISOString();
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const [pending, retry] = await Promise.all([
      db.from('ue_notifications').select(sel).eq('status', 'pending')
        .or(`deliver_after.is.null,deliver_after.lte.${now}`)
        .order('created_at').limit(50),
      db.from('ue_notifications').select(sel).eq('status', 'failed')
        .gte('created_at', dayAgo).lt('attempts', 3).order('created_at').limit(50),
    ]);
    if (pending.error) return new Response(JSON.stringify({ error: pending.error.message }), { status: 500 });
    rows = [...(pending.data || []), ...(retry.data || [])];
  }

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const r = row.channel === 'email'
      ? await sendEmail({ to: row.email || '', subject: row.subject || '', body: row.body })
      : await sendOne(row);
    if (r.ok) sent++; else failed++;
    await db.from('ue_notifications')
      .update({
        status: r.ok ? 'sent' : 'failed',
        detail: r.detail || '',
        attempts: (row.attempts || 0) + 1,
        sent_at: new Date().toISOString(),
      })
      .eq('id', row.id);
  }

  return new Response(JSON.stringify({ considered: rows.length, sent, failed }), {
    headers: { 'content-type': 'application/json' },
  });
});
