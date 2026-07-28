// notify-mark — the one write the hourly messenger needs.
// GET /notify-mark?secret=…&ids=<uuid,uuid>&status=sent|failed[&detail=…]
// GET is deliberate: the messenger runs where only simple fetches are
// available. The secret gates it; the service role does the update.
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  if (secret !== (Deno.env.get('NOTIFY_SECRET') || '')) {
    return new Response(JSON.stringify({ error: 'nope' }), { status: 403 });
  }
  const ids = (url.searchParams.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const status = url.searchParams.get('status') || 'sent';
  const detail = url.searchParams.get('detail') || '';
  if (!ids.length || !['sent', 'failed', 'skipped'].includes(status)) {
    return new Response(JSON.stringify({ error: 'bad params' }), { status: 400 });
  }
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await db
    .from('ue_notifications')
    .update({ status, detail, sent_at: new Date().toISOString() })
    .in('id', ids)
    .eq('status', 'pending')
    .select('id');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ marked: (data || []).map((r) => r.id) }), {
    headers: { 'content-type': 'application/json' },
  });
});
