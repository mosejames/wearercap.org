// wik-screen — reads a new Wish I Knew post, decides whether it can publish
// itself, and tells Mose either way.
//
// Called by the wik_posts insert trigger (0044) over pg_net, so there is no
// JWT: it authenticates on the shared webhook secret, same as `notify`.
//
// The one rule that matters here: this function may only ever move a row from
// pending to approved. Every failure path — no key, model down, bad JSON,
// timeout — leaves the row pending and sends the message with Publish/Decline
// buttons on it. A broken screen degrades to the behaviour the site had before
// it existed, which is the only acceptable way for a moderation step to break.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SECRET = Deno.env.get('WEBHOOK_SECRET') || '';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const TG_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TG_CHAT = Deno.env.get('TELEGRAM_CHAT_ID') || '';
// Deliberately not SITE_URL. That secret is shared with the carpool notifier
// and already carries a path on the end (.../carpool/), so building a link on
// it produced wearercap.org/carpool//wish-i-knew/read/ and a 404. This is the
// only site these messages are ever about, so it is a constant.
const BOARD_URL = 'https://wearercap.org/wish-i-knew/read/';

const MODEL = 'claude-haiku-4-5-20251001';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type Post = {
  id: string;
  kind: 'advice' | 'question' | 'answer';
  topic: string;
  headline: string;
  body: string | null;
  author_name: string | null;
  relation: string;
  grad_class: string;
  status: string;
};

type Verdict = { verdict: 'clean' | 'borderline' | 'violation'; reason: string };

// Written as house rules rather than as generic content policy, because the
// failure this is actually guarding against is not abuse — it is a well-meant
// post that names a teacher, or airs something that belongs in a private
// conversation, landing in front of a family who has not started yet.
const SYSTEM = `You screen short posts written by parents at Ron Clark Academy for a page that welcomes incoming families. You are the first reader; a person sees your verdict afterwards.

Return CLEAN only if the post is all of these:
- Practical or encouraging, aimed at helping a family who is new.
- About how things work — routines, uniforms, carpool, homework, traditions, finding your footing.
- Free of any named individual other than the writer. No teacher, staff member, administrator or student by name, initials, nickname or unmistakable description ("the sixth grade math teacher who").
- Free of contact details, links, addresses, prices being solicited, or anything selling something.
- Not a complaint about a person, not a grievance, not a dispute, not a rumour, not anything about discipline, bullying, safety incidents, or a specific child.

Return BORDERLINE if it is probably fine but you are not certain — anything you would want a human to glance at, anything ambiguous, anything mildly negative in tone, anything that reads like it might be about a specific person without naming them, or anything you simply cannot categorise.

Return VIOLATION for: naming or clearly identifying a teacher, staff member or student; an attack on anyone; a grievance or complaint about the school or a person; anything about bullying, discipline or a safety incident; spam, advertising or solicitation; contact details; profanity; or anything a new family should not be met with.

When you are unsure, you are BORDERLINE. Never stretch to CLEAN.

Reply with JSON only, no prose, no code fence:
{"verdict":"clean|borderline|violation","reason":"under 15 words"}`;

async function screen(p: Post): Promise<Verdict> {
  if (!ANTHROPIC_KEY) return { verdict: 'borderline', reason: 'No model key configured' };

  const submitted = [
    `Type: ${p.kind}`,
    `Topic: ${p.topic}`,
    `From: a Class of ${p.grad_class} ${p.relation}`,
    ``,
    p.headline,
    p.body ? `\n${p.body}` : '',
  ].join('\n');

  // The writer is watching a spinner while this runs, so it is better to give
  // up and hand the post to a human than to keep them waiting.
  const abort = AbortSignal.timeout(9000);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: abort,
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system: SYSTEM,
        messages: [{ role: 'user', content: submitted }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { verdict: 'borderline', reason: `Model ${res.status}: ${detail.slice(0, 60)}` };
    }

    const json = await res.json();
    const text: string = json?.content?.[0]?.text ?? '';

    // Defensive: take the first {...} in case the model wraps it in anything.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { verdict: 'borderline', reason: 'Unreadable model reply' };

    const parsed = JSON.parse(match[0]);
    const v = String(parsed?.verdict || '').toLowerCase();
    if (v !== 'clean' && v !== 'borderline' && v !== 'violation') {
      return { verdict: 'borderline', reason: 'Unknown verdict from model' };
    }
    return { verdict: v, reason: String(parsed?.reason || '').slice(0, 140) };
  } catch (e) {
    return { verdict: 'borderline', reason: `Screen failed: ${String(e).slice(0, 60)}` };
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const KIND_LABEL: Record<string, string> = {
  advice: 'Advice',
  question: 'Question',
  answer: 'Answer',
};

async function telegram(p: Post, v: Verdict, published: boolean) {
  if (!TG_TOKEN || !TG_CHAT) return;

  const who = p.author_name
    ? `${p.author_name} · Class of ${p.grad_class} ${p.relation}`
    : `A Class of ${p.grad_class} ${p.relation}`;

  const head = published
    ? `✅ <b>Published</b> — ${KIND_LABEL[p.kind] || p.kind}`
    : v.verdict === 'violation'
      ? `⛔️ <b>Held — looks like a problem</b>`
      : `🟡 <b>Held — wants your eyes</b>`;

  const lines = [
    head,
    ``,
    `<b>${esc(p.headline)}</b>`,
    p.body ? esc(p.body) : '',
    ``,
    `<i>${esc(who)} · ${esc(p.topic)}</i>`,
    `<i>Screen: ${esc(v.reason || v.verdict)}</i>`,
  ].filter(Boolean);

  // One row of buttons. Published posts need only a way out; held ones need
  // both directions. callback_data is capped at 64 bytes — "pub:" + a uuid is 40.
  const keyboard = published
    ? [[{ text: '🗑 Take it down', callback_data: `dec:${p.id}` }]]
    : [[
        { text: '✅ Publish', callback_data: `pub:${p.id}` },
        { text: '🚫 Decline', callback_data: `dec:${p.id}` },
      ]];

  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TG_CHAT,
      text: lines.join('\n'),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          ...keyboard,
          [{ text: 'Open the board', url: BOARD_URL }],
        ],
      },
    }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (SECRET && req.headers.get('x-webhook-secret') !== SECRET) {
    return new Response('no', { status: 401 });
  }

  let record: Post;
  try {
    const payload = await req.json();
    record = payload?.record;
    if (!record?.id) return new Response('no record', { status: 400 });
  } catch {
    return new Response('bad json', { status: 400 });
  }

  // Only ever act on something still waiting. Guards against a replayed
  // webhook re-publishing a post a human already declined.
  if (record.status !== 'pending') {
    return new Response(JSON.stringify({ skipped: record.status }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const verdict = await screen(record);
  const publish = verdict.verdict === 'clean';

  const { error } = await db.rpc('wik_apply_verdict', {
    p_id: record.id,
    p_status: publish ? 'approved' : null,
    p_verdict: verdict.verdict,
    p_reason: verdict.reason,
  });

  // If the write failed the post is still pending, so tell Mose it is held
  // rather than claiming a publish that did not happen.
  const published = publish && !error;

  await telegram(record, verdict, published);

  return new Response(
    JSON.stringify({ id: record.id, verdict: verdict.verdict, published }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
