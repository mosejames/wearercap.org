import React, { useEffect, useState } from "react";
import { supabase } from "./api.js";
export default function NotificationPreferences({ user, onError }) {
  const [channel, setChannel] = useState("sms"),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    supabase.rpc("cr_notification_preference").then(({ data, error }) => {
      if (!live) return;
      if (error) onError("Could not load notification preferences.");
      else setChannel(data.channel);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [user.id]);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    onError("");
    try {
      const { error } = await supabase.rpc("cr_notification_preference", {
        p_channel: channel,
      });
      if (error) throw error;
      setNotice(
        "Notification preference saved. It applies to future updates on your current and new requests.",
      );
    } catch (e) {
      onError(e.message || "Could not save your preference.");
    } finally {
      setBusy(false);
    }
  }
  const phone = Boolean(user.phone && user.phone_confirmed_at),
    email = Boolean(user.email && user.email_confirmed_at);
  return (
    <section className="record-card" style={{ marginBottom: 20 }}>
      <h3>Request notifications</h3>
      <p className="muted">
        Choose how to receive review, approval, changes requested, declined, and
        payment updates. Board members also receive their review-queue updates
        this way.
      </p>
      {loading ? (
        <p>Loading your preference…</p>
      ) : (
        <form onSubmit={save}>
          <label className="field">
            <span>Send status updates by</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="sms" disabled={!phone}>
                Text message
              </option>
              <option value="email" disabled={!email}>
                Email
              </option>
              <option value="both" disabled={!phone || !email}>
                Text and email
              </option>
            </select>
          </label>
          <p className="muted">
            {phone ? `Texts: ${user.phone}. ` : ""}
            {email
              ? `Emails: ${user.email}.`
              : "Add and verify your email under Account & backup sign-in to enable email updates."}
          </p>
          <button className="secondary" disabled={busy}>
            {busy ? "Saving…" : "Save notification preference"}
          </button>
        </form>
      )}
      <p className="muted">
        Optional emailed PDF copies are separate from status updates.
      </p>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
