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

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

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
  const sel = 'id,phone,body,attempts';

  let rows: Array<{ id: string; phone: string; body: string; attempts?: number }> = [];
  if (id) {
    const { data, error } = await db.from('ue_notifications').select(sel).eq('id', id).eq('status', 'pending');
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    rows = data || [];
  } else {
    // Sweeper: everything still pending, plus recent failures worth another
    // go. After a day, or three tries, we stop rattling a bad number.
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const [pending, retry] = await Promise.all([
      db.from('ue_notifications').select(sel).eq('status', 'pending').order('created_at').limit(50),
      db.from('ue_notifications').select(sel).eq('status', 'failed')
        .gte('created_at', dayAgo).lt('attempts', 3).order('created_at').limit(50),
    ]);
    if (pending.error) return new Response(JSON.stringify({ error: pending.error.message }), { status: 500 });
    rows = [...(pending.data || []), ...(retry.data || [])];
  }

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const r = await sendOne(row);
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
