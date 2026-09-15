// event-confirm: the mail and the board alerts for event RSVPs.
//
//   { kind: 'confirm', token }              email the parent + alert the board
//   { kind: 'comment', token, comment_id }  alert the board about a new note
//   { kind: 'reminder', pass, slug }        morning-of email to everyone going
//   { kind: 'confirm', token, preview }     render the email without sending
//
// Called straight from the browser. For confirm and comment the token IS the
// authorisation: it can only buy one email to the address already on that row
// and one alert about that row's own words, and the *_at columns make each a
// one-time thing. The caller never supplies an address, so this is not a relay.
// Reminder takes the back-office passcode. verify_jwt is off because the site
// ships a publishable key, which is not a JWT.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { asHtml, asText } from './shell.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || '';
const MAIL_FROM = Deno.env.get('RESEND_FROM') || 'RCAP <hello@wearercap.org>';
const TG_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TG_CHAT = Deno.env.get('TELEGRAM_CHAT_ID') || '';
const ADMIN_PASS = 'rcap2026';
const SITE = 'https://wearercap.org';
const FLYER = `${SITE}/meeting/sept-14/parent-social-flyer.jpg`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const esc = (t: string) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const HOUSE: Record<string, string> = { amistad: 'Amistad', isibindi: 'Isibindi', reveur: 'Rêveur', altruismo: 'Altruismo' };
const TZ = 'America/New_York';

function when(ev: any) {
  const s = new Date(ev.starts_at), e = new Date(ev.ends_at);
  const day = s.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ });
  const t = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).replace(':00', '');
  return { day, time: `${t(s)} to ${t(e)}` };
}

const maps = (ev: any) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([ev.venue_name, ev.venue_address].filter(Boolean).join(', '))}`;

async function going(eventId: string) {
  const { data } = await db.rpc('event_going_count', { p_event: eventId });
  return Number(data || 0);
}

function compose(row: any, ev: any, kind: 'confirm' | 'reminder') {
  const first = String(row.full_name || '').trim().split(/\s+/)[0] || 'there';
  const w = when(ev);
  const link = `${SITE}/rsvp/${ev.slug}?t=${row.token}`;
  const lines: string[] = [];
  if (kind === 'confirm') {
    lines.push(`## You're on the wall, ${first}.`);
    lines.push(`${ev.title}. We saved you a spot${row.plus_one_name ? `, and one for ${row.plus_one_name}` : ''}.`);
  } else {
    lines.push(`## Tonight, ${first}.`);
    lines.push(`${ev.title} is today. Bring a song or bring a friend who has one.`);
  }
  lines.push(`**${w.day}**\n${w.time}\n${ev.venue_name}${ev.venue_address ? `, ${ev.venue_address}` : ''}`);
  lines.push('Adults only. Leave the kids with someone who loves them.');
  lines.push(`[Open your RSVP](${link})`);
  lines.push(`+[Add to calendar](${SITE}/rsvp/${ev.slug}/calendar.ics)`);
  lines.push(`+[Directions](${maps(ev)})`);
  if (ev.slug === 'karaoke-sept-27') lines.push(`![Parent Social: R&B Karaoke flyer](${FLYER})`);
  lines.push('> That button is your private link. It changes or cancels your RSVP and lets you post in the thread, so keep it to yourself. If anything looks wrong, reply to this email.');
  const subject = kind === 'confirm' ? `You're in: ${ev.title}` : `Today: ${ev.title}`;
  return { subject, body: lines.join('\n\n') };
}

async function mail(to: string, subject: string, body: string) {
  if (!RESEND_KEY) return { ok: false, detail: 'Email not configured' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, text: asText(body), html: asHtml(subject, body) }),
    });
    const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    return { ok: r.ok, detail: r.ok ? String(j.id || '') : `${r.status} ${j.message || ''}`.slice(0, 180) };
  } catch (e) {
    return { ok: false, detail: String(e).slice(0, 180) };
  }
}

async function telegram(text: string, photo: string | null, slug: string) {
  if (!TG_TOKEN || !TG_CHAT) return false;
  const reply_markup = { inline_keyboard: [[{ text: 'Open the list', url: `${SITE}/rsvp/${slug}#admin` }]] };
  const method = photo ? 'sendPhoto' : 'sendMessage';
  const payload = photo
    ? { chat_id: TG_CHAT, photo, caption: text, parse_mode: 'HTML', reply_markup }
    : { chat_id: TG_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup };
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }).catch(() => null);
  return !!(r && r.ok);
}

const photoUrl = (row: any) =>
  row.photo_path
    ? `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/event-photos/${row.photo_path}?v=${Math.floor(new Date(row.updated_at).getTime() / 1000)}`
    : null;

async function byToken(token: string) {
  const { data } = await db.from('event_rsvps').select('*, events(*)').eq('token', token).maybeSingle();
  return data as any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: 'bad body' }, 400); }
  const kind = String(b.kind || 'confirm');
  const token = String(b.token || '');

  if (kind === 'reminder') {
    if (b.pass !== ADMIN_PASS) return json({ error: 'no' }, 401);
    const { data: ev } = await db.from('events').select('*').eq('slug', String(b.slug || '')).maybeSingle();
    if (!ev) return json({ error: 'not found' }, 404);
    const { data: rows } = await db.from('event_rsvps').select('*').eq('event_id', ev.id).eq('status', 'going').is('reminder_sent_at', null);
    let sent = 0;
    const failed: string[] = [];
    for (const row of rows || []) {
      const { subject, body } = compose(row, ev, 'reminder');
      const r = await mail(row.email, subject, body);
      if (r.ok) {
        sent++;
        await db.from('event_rsvps').update({ reminder_sent_at: new Date().toISOString() }).eq('id', row.id);
      } else failed.push(`${row.full_name}: ${r.detail}`);
    }
    return json({ sent, failed });
  }

  if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ error: 'bad token' }, 400);
  const row = await byToken(token);
  if (!row) return json({ error: 'not found' }, 404);
  const ev = row.events;

  if (b.preview) {
    const { subject, body } = compose(row, ev, kind === 'reminder' ? 'reminder' : 'confirm');
    return new Response(asHtml(subject, body), { headers: { ...CORS, 'Content-Type': 'text/html' } });
  }

  if (kind === 'comment') {
    const id = String(b.comment_id || '');
    const { data: c } = await db.from('event_comments').select('*').eq('id', id).maybeSingle();
    if (!c || c.rsvp_id !== row.id) return json({ error: 'not found' }, 404);
    if (c.notified_at) return json({ skipped: 'already sent' });
    const ok = await telegram(
      `💬 <b>${esc(row.wall_name)}</b> in the ${esc(ev.title)} thread${c.prompt ? `\n<i>${esc(c.prompt)}</i>` : ''}\n\n${esc(c.body)}\n\n<i>${esc(row.full_name)}. Public on the page. Hide it from the list if it needs to come down.</i>`,
      null, ev.slug,
    );
    if (ok) await db.from('event_comments').update({ notified_at: new Date().toISOString() }).eq('id', c.id);
    return json({ alerted: ok });
  }

  if (row.status !== 'going') return json({ skipped: 'not going' });
  const out: Record<string, unknown> = {};

  if (!row.confirm_sent_at && String(row.email || '').includes('@')) {
    const { subject, body } = compose(row, ev, 'confirm');
    const r = await mail(row.email, subject, body);
    await db.from('event_rsvps').update(r.ok
      ? { confirm_sent_at: new Date().toISOString(), confirm_error: null }
      : { confirm_error: r.detail }).eq('id', row.id);
    out.email = r.ok ? 'sent' : r.detail;
  }

  if (!row.board_notified_at) {
    const n = await going(ev.id);
    const extra = [HOUSE[row.house] || 'No house', (row.grades || []).length ? `grade ${(row.grades || []).join(', ')}` : ''].filter(Boolean).join(' · ');
    const text = `🎤 <b>${esc(row.wall_name)} is in${row.plus_one_name ? ' (+1)' : ''}.</b> ${n} going.\n<i>${esc(row.full_name)} · ${esc(extra)}${row.plus_one_name ? ` · with ${esc(row.plus_one_name)}` : ''}</i>`;
    const ok = await telegram(text, photoUrl(row), ev.slug);
    if (ok) await db.from('event_rsvps').update({ board_notified_at: new Date().toISOString() }).eq('id', row.id);
    out.board = ok;
  }

  return json(out);
});
