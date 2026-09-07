import { deliverArchive } from "./archive.ts";
import { sendNotice } from "./send.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.7";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const secret = req.headers.get("x-cr-secret");
  if (!secret || secret.length !== 64)
    return json({ error: "Unauthorized" }, 401);
  // Auth is a random, database-held key. It is never exposed to a browser.
  // Claims are atomic; concurrent trigger/cron calls cannot send the same row.
  const { data: jobs, error } = await db.rpc("cr_claim_notifications", {
    p_secret: secret,
  });
  if (error) return json({ error: "Unauthorized or unavailable" }, 403);
  const config = {
    emailKey: Deno.env.get("RESEND_API_KEY") || "",
    emailFrom: Deno.env.get("RESEND_FROM") || "RCAP <hello@wearercap.org>",
    smsSid: Deno.env.get("TWILIO_ACCOUNT_SID") || "",
    smsToken: Deno.env.get("TWILIO_AUTH_TOKEN") || "",
    smsFrom: Deno.env.get("TWILIO_FROM") || "",
    smsService: Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || "",
  };
  let sent = 0,
    failed = 0;
  for (const job of jobs || []) {
    try {
      if (job.archive_snapshot) await deliverArchive(job, db, config);
      else await sendNotice(job, config);
      const { error: saveError } = await db
        .from("cr_notifications")
        .update({
          state: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", job.id);
      if (saveError) throw new Error("Delivery status could not be recorded.");
      sent++;
    } catch (e) {
      await db
        .from("cr_notifications")
        .update({
          state: "failed",
          last_error: e instanceof Error ? e.message : "Delivery failed.",
        })
        .eq("id", job.id);
      failed++;
    }
  }
  return json({
    sent,
    failed,
    emailConfigured: !!config.emailKey,
    smsConfigured: !!(
      config.smsSid &&
      config.smsToken &&
      (config.smsFrom || config.smsService)
    ),
  });
});
