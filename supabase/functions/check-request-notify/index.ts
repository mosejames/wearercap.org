import { requesterRecap } from "./recap.ts";
import { deliverArchive } from "./archive.ts";
import { sendNotice, deliveryStatus } from "./send.ts";
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
      let result = { providerId: null as string | null, failed: [] as string[] };
      if (job.archive_snapshot) await deliverArchive(job, db, config);
      else
        result = await sendNotice(
          job.notice_snapshot
            ? { ...job, body: requesterRecap(job.notice_snapshot, false) }
            : job,
          config,
        );
      // A group email that reached some addresses but not others is "sent",
      // with the refused addresses recorded so nobody assumes they got it.
      const partial = result.failed.length
        ? `Resend refused ${result.failed.join(", ")}; the other recipients received it.`
        : null;
      if (partial) console.error(`cr_notifications ${job.id}: ${partial}`);
      const { error: saveError } = await db
        .from("cr_notifications")
        .update({
          state: "sent",
          sent_at: new Date().toISOString(),
          last_error: partial,
          provider_id: result.providerId,
        })
        .eq("id", job.id);
      if (saveError) throw new Error("Delivery status could not be recorded.");
      sent++;
    } catch (e) {
      console.error(
        `cr_notifications ${job.id} to ${job.recipient} failed:`,
        e instanceof Error ? e.message : e,
      );
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
  // Follow up on group emails Resend accepted: record delivered or bounced.
  // A bounce is logged and written to last_error; it never passes silently.
  let checked = 0;
  if (config.emailKey) {
    const { data: pending } = await db.rpc("cr_delivery_checks", {
      p_secret: secret,
    });
    for (const row of pending || []) {
      const status = await deliveryStatus(row.provider_id, config).catch(
        () => null,
      );
      if (!status) {
        await db
          .from("cr_notifications")
          .update({ delivery_checked_at: new Date().toISOString() })
          .eq("id", row.id);
        continue;
      }
      const bad = ["bounced", "complained", "failed"].includes(status);
      if (bad)
        console.error(
          `cr_notifications ${row.id} (${row.recipient}): Resend reports ${status}`,
        );
      await db
        .from("cr_notifications")
        .update({
          delivery_status: status,
          delivery_checked_at: new Date().toISOString(),
          ...(bad
            ? {
                last_error: `Resend reports ${status}. At least one address did not receive this email; check the Resend log for which one.`,
              }
            : {}),
        })
        .eq("id", row.id);
      checked++;
    }
  }
  return json({
    sent,
    failed,
    checked,
    emailConfigured: !!config.emailKey,
    smsConfigured: !!(
      config.smsSid &&
      config.smsToken &&
      (config.smsFrom || config.smsService)
    ),
  });
});
