// event-photo: the only way a file reaches the event-photos bucket.
//
// The bucket is public to read and has no write policy at all. The browser
// sends its RSVP token and a base64 JPEG it already squared and shrank; this
// checks the token, checks the bytes really are a small JPEG, and writes
// <event_id>/<rsvp_id>.jpg with the service key. Photos go live straight
// away, so a replacement after the first board alert is posted to the board
// too, where it can be pulled from the back office.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL_BASE = Deno.env.get('SUPABASE_URL')!;
const db = createClient(URL_BASE, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const TG_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TG_CHAT = Deno.env.get('TELEGRAM_CHAT_ID') || '';
const MAX = 400 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const esc = (t: string) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: 'bad body' }, 400); }
  const token = String(b.token || '');
  const image = String(b.image || '');
  if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ error: 'bad token' }, 400);
  if (!image || image.length > Math.ceil(MAX * 4 / 3) + 8) return json({ error: 'photo too large' }, 413);

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
  } catch {
    return json({ error: 'bad image' }, 400);
  }
  if (bytes.length > MAX || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return json({ error: 'not a jpeg' }, 400);

  const { data: row } = await db.from('event_rsvps').select('id, event_id, status, wall_name, full_name, board_notified_at, events(slug)').eq('token', token).maybeSingle();
  if (!row || row.status !== 'going') return json({ error: 'rsvp required' }, 403);

  const path = `${row.event_id}/${row.id}.jpg`;
  const up = await db.storage.from('event-photos').upload(path, bytes, { contentType: 'image/jpeg', upsert: true, cacheControl: '300' });
  if (up.error) return json({ error: up.error.message }, 500);

  const now = new Date().toISOString();
  await db.from('event_rsvps').update({ photo_path: path, updated_at: now }).eq('id', row.id);
  const photo_url = `${URL_BASE}/storage/v1/object/public/event-photos/${path}?v=${Math.floor(Date.parse(now) / 1000)}`;

  if (row.board_notified_at && TG_TOKEN && TG_CHAT) {
    const slug = (row as any).events?.slug || '';
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT, photo: photo_url, parse_mode: 'HTML',
        caption: `📷 New wall photo from <b>${esc(row.wall_name)}</b> (${esc(row.full_name)}).`,
        reply_markup: { inline_keyboard: [[{ text: 'Open the list', url: `https://wearercap.org/rsvp/${slug}#admin` }]] },
      }),
    }).catch(() => {});
  }

  return json({ photo_url });
});
