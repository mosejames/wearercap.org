// wik-telegram — the button taps.
//
// Telegram POSTs here when Mose taps Publish, Decline or Take it down on one
// of wik-screen's messages. It flips the row and edits the original message in
// place, so the buttons are replaced by what happened. Editing rather than
// replying is the whole reason this feels like one tap instead of a thread.
//
// This endpoint is public and unauthenticated by Telegram's design, and the
// project ref is in the site's own JS bundle, so the URL is effectively known.
// Two locks, both required:
//   1. Telegram's own secret token, set with setWebhook and echoed back in the
//      X-Telegram-Bot-Api-Secret-Token header on every call.
//   2. The chat id on the callback must be Mose's.
// Without the first, anyone who authored a post knows its id (the client
// generates it) and could forge a callback to publish their own post, which
// would make the whole screen theatre.
const TG_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TG_CHAT = Deno.env.get('TELEGRAM_CHAT_ID') || '';
const HOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';

import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const api = (method: string, body: unknown) =>
  fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});

Deno.serve(async (req) => {
  // Lock 1. Refuse outright if it is not configured — an open door here is
  // worse than a broken button.
  if (!HOOK_SECRET || req.headers.get('x-telegram-bot-api-secret-token') !== HOOK_SECRET) {
    return new Response('no', { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }

  const cq = update?.callback_query;
  if (!cq) return new Response('ok'); // ordinary messages to the bot: ignore

  // Lock 2.
  if (String(cq.from?.id) !== String(TG_CHAT)) {
    await api('answerCallbackQuery', { callback_query_id: cq.id, text: 'Not for you.' });
    return new Response('ok');
  }

  const [action, id] = String(cq.data || '').split(':');
  const status = action === 'pub' ? 'approved' : action === 'dec' ? 'declined' : null;

  if (!status || !id) {
    await api('answerCallbackQuery', { callback_query_id: cq.id, text: 'Unknown action.' });
    return new Response('ok');
  }

  const { error } = await db.rpc('wik_apply_verdict', {
    p_id: id,
    p_status: status,
    p_verdict: null,
    p_reason: null,
  });

  // Clears the spinner on the button. Telegram shows this as a toast.
  await api('answerCallbackQuery', {
    callback_query_id: cq.id,
    text: error ? 'That did not save.' : status === 'approved' ? 'Published' : 'Taken down',
  });

  if (error) return new Response('ok');

  // Rewrite the message it was attached to: keep the post visible, drop the
  // buttons, and stamp the outcome on the end.
  const original: string = cq.message?.text || '';
  const stamp = status === 'approved' ? '✅ Published' : '🚫 Declined';
  const when = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  await api('editMessageText', {
    chat_id: cq.message.chat.id,
    message_id: cq.message.message_id,
    text: `${original}\n\n${stamp} · ${when}`,
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [] },
  });

  return new Response('ok');
});
