// supabase/functions/notify/index.ts
//
// Single Edge Function fielding three Supabase Database Webhooks:
//   1. members  INSERT                              -> email approved admins ("new signup")
//   2. members  UPDATE (pending -> approved)         -> email the member ("you're approved")
//   3. families INSERT                               -> email nearby approved families
//
// Dispatch is on the webhook payload's `table` + `type` fields. Payload shape
// (Supabase Database Webhooks -> HTTP Request): { type, table, schema, record, old_record }.
// INSERT: old_record is null. UPDATE: old_record is the pre-update row.
//
// Auth: every request must carry header `x-webhook-secret` matching the
// `WEBHOOK_SECRET` function secret, checked BEFORE the body is parsed. This
// keeps random internet POSTs from triggering email sends (Database Webhooks
// support custom headers, which is how this secret gets attached).
//
// Every individual email send is try/caught: a bad address or a Resend
// hiccup is logged and skipped, never turned into a 500 for the webhook
// (Supabase retries/fails the webhook delivery on non-2xx).
//
// Env (Edge Function secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  - auto-injected by the platform
//   WEBHOOK_SECRET                            - shared secret, set via `supabase secrets set`
//   RESEND_API_KEY                            - Resend API key
//   NOTIFY_FROM                               - verified "From" address, e.g. "RCAP Carpool <carpool@wearercap.org>"
//   SITE_URL                                  - e.g. "https://wearercap.org/carpool"

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFY_FROM = Deno.env.get("NOTIFY_FROM");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://wearercap.org/carpool";

const NEARBY_RADIUS_MILES = 5;
const NEARBY_THROTTLE_MS = 24 * 60 * 60 * 1000; // 24h

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
};

type EmailResult = { to: string; ok: boolean; error?: string };

// ---------------------------------------------------------------------------
// Haversine distance in statute miles. Reimplemented here (not shared with
// the client or with the Postgres helper in 0003_onboarding_map.sql) so this
// function has no build-time dependency on the app bundle. Mirrors the SQL
// version's acos clamp to guard against floating-point drift pushing the
// argument fractionally outside [-1, 1].
function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const cosArg =
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.cos(toRad(lng2) - toRad(lng1)) +
    Math.sin(toRad(lat1)) * Math.sin(toRad(lat2));
  const clamped = Math.max(-1, Math.min(1, cosArg));
  return 3959 * Math.acos(clamped);
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<EmailResult> {
  try {
    if (!RESEND_API_KEY || !NOTIFY_FROM) {
      throw new Error("RESEND_API_KEY or NOTIFY_FROM not configured");
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: NOTIFY_FROM, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend ${res.status}: ${body}`);
    }
    return { to, ok: true };
  } catch (err) {
    console.error(`notify: email to ${to} failed:`, err);
    return { to, ok: false, error: String(err) };
  }
}

// Defaults to the plain site link. Callers that want a deep link (the admin
// notification wants the panel, not the front door) pass their own href.
function siteLinkParagraph(href: string = SITE_URL): string {
  return `<p><a href="${href}">${href}</a></p>`;
}

// ---------------------------------------------------------------------------
// members INSERT -> tell approved admins a new family joined. Signups are
// auto-approved now, so this is a heads-up for review after the fact, not a
// request to unblock anyone.
async function handleMemberInsert(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  record: Record<string, unknown>,
): Promise<EmailResult[]> {
  const newEmail = String(record.email ?? "");

  const { data: admins, error } = await supabase
    .from("members")
    .select("email")
    .eq("role", "admin")
    .eq("approval", "approved");

  if (error) {
    console.error("notify: failed to load approved admins:", error);
    return [];
  }

  // The urgency of this email depends on a setting an admin can flip at any
  // time (0008's public.settings.auto_approve_signups). With auto-approve on,
  // nothing is blocked and this is a heads-up. With it off, the new family is
  // locked out until somebody acts, and saying "nothing is waiting on you"
  // would be a lie that strands them. Read the flag rather than guessing.
  // Failure to read it falls back to the more urgent wording, because
  // over-prompting an admin is a smaller harm than a family waiting unseen.
  let autoApprove = false;
  const { data: settings, error: settingsError } = await supabase
    .from("settings")
    .select("auto_approve_signups")
    .maybeSingle();
  if (settingsError) {
    console.error("notify: failed to read settings, assuming review mode:", settingsError);
  } else {
    autoApprove = settings?.auto_approve_signups === true;
  }

  // Same zero-PII rule as the nearby-family email: nothing about the new
  // family beyond the address that was already here. Details live behind the
  // admin panel, which is what the link opens.
  const subject = autoApprove
    ? "A new family joined RCAP Carpool"
    : "A new family is waiting for approval";
  const html = autoApprove
    ? `
    <p>${newEmail} just joined RCAP Carpool. New families are approved automatically, so nothing is waiting on you.</p>
    <p>Open the admin panel when you have a moment to look them over.</p>
    ${siteLinkParagraph(`${SITE_URL}#admin`)}
  `
    : `
    <p>${newEmail} just signed up for RCAP Carpool. Signups are being held for review, so they cannot see anything until someone approves them.</p>
    ${siteLinkParagraph(`${SITE_URL}#admin`)}
  `;

  const results = await Promise.all(
    (admins ?? []).map((admin) =>
      sendEmail(String((admin as { email: string }).email), subject, html)
    ),
  );
  return results;
}

// ---------------------------------------------------------------------------
// members UPDATE, pending -> approved -> tell the member they're in.
async function handleMemberApproved(
  record: Record<string, unknown>,
): Promise<EmailResult[]> {
  const email = String(record.email ?? "");
  if (!email) return [];

  const subject = "You're approved. Your carpool map is live";
  const html = `
    <p>You're approved for RCAP Carpool. Your carpool map is live.</p>
    ${siteLinkParagraph()}
  `;

  return [await sendEmail(email, subject, html)];
}

// ---------------------------------------------------------------------------
// families INSERT -> tell nearby approved families (no PII about the new one).
async function handleFamilyInsert(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  record: Record<string, unknown>,
): Promise<EmailResult[]> {
  const newUserId = String(record.user_id ?? "");
  const newLat = Number(record.area_lat);
  const newLng = Number(record.area_lng);

  if (!newUserId || !Number.isFinite(newLat) || !Number.isFinite(newLng)) {
    console.error("notify: families INSERT record missing user_id/area_lat/area_lng");
    return [];
  }

  const { data: approvedMembers, error: membersErr } = await supabase
    .from("members")
    .select("user_id")
    .eq("approval", "approved");

  if (membersErr) {
    console.error("notify: failed to load approved members:", membersErr);
    return [];
  }
  const approvedIds = new Set(
    (approvedMembers ?? []).map((m) => String((m as { user_id: string }).user_id)),
  );

  const { data: families, error: famErr } = await supabase
    .from("families")
    .select("user_id, area_lat, area_lng, contact_email, nearby_notified_at")
    .neq("user_id", newUserId);

  if (famErr) {
    console.error("notify: failed to load families:", famErr);
    return [];
  }

  const now = Date.now();
  type FamilyRow = {
    user_id: string;
    area_lat: number;
    area_lng: number;
    contact_email: string;
    nearby_notified_at: string | null;
  };

  const recipients = ((families ?? []) as FamilyRow[]).filter((f) => {
    if (!approvedIds.has(f.user_id)) return false;
    if (!Number.isFinite(f.area_lat) || !Number.isFinite(f.area_lng)) return false;
    const distance = haversineMiles(newLat, newLng, f.area_lat, f.area_lng);
    if (distance > NEARBY_RADIUS_MILES) return false;
    if (f.nearby_notified_at) {
      const notifiedAt = new Date(f.nearby_notified_at).getTime();
      if (now - notifiedAt < NEARBY_THROTTLE_MS) return false;
    }
    return true;
  });

  if (recipients.length === 0) return [];

  // Deliberately NO name/address/area_label from the new family in the body
  // — recipients log in to see the pin on the map.
  const subject = "A new family joined the carpool map in your area";
  const html = `
    <p>A new family joined the carpool map in your area.</p>
    <p>Log in to see where they are on the map.</p>
    ${siteLinkParagraph()}
  `;

  const results = await Promise.all(
    recipients.map((f) => sendEmail(f.contact_email, subject, html)),
  );

  const { error: updateErr } = await supabase
    .from("families")
    .update({ nearby_notified_at: new Date().toISOString() })
    .in("user_id", recipients.map((f) => f.user_id));

  if (updateErr) {
    console.error("notify: failed to update nearby_notified_at:", updateErr);
  }

  return results;
}

// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  // Auth gate FIRST, before touching the body.
  const providedSecret = req.headers.get("x-webhook-secret");
  if (!WEBHOOK_SECRET || !providedSecret || providedSecret !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { type, table, record, old_record } = payload;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let results: EmailResult[] = [];
  let action = "noop";

  try {
    if (table === "members" && type === "INSERT" && record) {
      action = "member_insert_notify_admins";
      results = await handleMemberInsert(supabase, record);
    } else if (table === "members" && type === "UPDATE" && record) {
      const approvedNow = record.approval === "approved";
      const wasPending = (old_record?.approval ?? null) === "pending";
      if (approvedNow && wasPending) {
        action = "member_approved_notify_member";
        results = await handleMemberApproved(record);
      } else {
        action = "member_update_noop";
      }
    } else if (table === "families" && type === "INSERT" && record) {
      action = "family_insert_notify_nearby";
      results = await handleFamilyInsert(supabase, record);
    }
  } catch (err) {
    // Belt-and-suspenders: even an unexpected error in dispatch must not
    // turn into a 500 for the webhook. Log and fall through to 200.
    console.error("notify: unexpected error handling webhook:", err);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      table,
      type,
      action,
      emailsAttempted: results.length,
      emailsSent: results.filter((r) => r.ok).length,
      emailsFailed: results.filter((r) => !r.ok).length,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
