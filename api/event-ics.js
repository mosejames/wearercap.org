// ---------------------------------------------------------------------------
// Add to calendar for an event page: /rsvp/<slug>/calendar.ics (and
// /api/event-ics?slug=<slug>). A real text/calendar response rather than a
// blob link, because iOS Safari hands a served .ics straight to Calendar and
// does nothing useful with a client-side download.
// ---------------------------------------------------------------------------

const SITE = 'https://wearercap.org';
const SUPA = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const text = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/* RFC 5545 wants lines folded at 75 octets. */
function fold(line) {
  const out = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

export function buildIcs(ev, now = new Date().toISOString()) {
  const url = `${SITE}/rsvp/${ev.slug}`;
  const location = [ev.venue_name, ev.venue_address].filter(Boolean).join(', ');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RCAP//wearercap.org//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.slug}@wearercap.org`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(ev.starts_at)}`,
    `DTEND:${stamp(ev.ends_at)}`,
    `SUMMARY:${text(ev.title)}`,
    `LOCATION:${text(location)}`,
    `DESCRIPTION:${text([ev.blurb, 'Adults only.', url].filter(Boolean).join('\n\n'))}`,
    `URL:${url}`,
    'BEGIN:VALARM', 'TRIGGER:-PT3H', 'ACTION:DISPLAY', `DESCRIPTION:${text(ev.title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export default async function handler(req, res) {
  const slug = String((req.query && req.query.slug) || '').trim().toLowerCase();
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !SUPA || !KEY) return res.status(404).send('Not found');
  let ev = null;
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/event_get`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
      signal: AbortSignal.timeout(3000),
    });
    ev = r.ok ? await r.json() : null;
  } catch {
    ev = null;
  }
  if (!ev || !ev.slug) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${slug}.ics"`);
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
  return res.status(200).send(buildIcs(ev));
}
