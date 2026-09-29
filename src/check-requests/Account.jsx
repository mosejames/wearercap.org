import React, { useState } from "react";
import { supabase } from "./api.js";
export default function Account({ user, onError }) {
  const [email, setEmail] = useState(user.email || "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    onError("");
    try {
      const { error } = sent
        ? await supabase.auth.verifyOtp({
            email: email.trim().toLowerCase(),
            token: code.trim(),
            type: "email_change",
          })
        : await supabase.auth.updateUser(
            { email: email.trim().toLowerCase() },
            { emailRedirectTo: location.origin + "/check-requests/" },
          );
      if (error) throw error;
      if (sent) {
        setNotice(
          "Email verified. You can now use it to sign in to this same account.",
        );
        setSent(false);
      } else {
        setSent(true);
        setNotice(
          "Check your email for a confirmation link or code. If changing an existing email, confirm both addresses.",
        );
      }
    } catch (e) {
      onError(
        /already|registered|exists/i.test(e.message || "")
          ? "That email belongs to an existing account. Keep using cellphone sign-in and contact RCAP for help connecting your accounts, or use another backup email."
          : e.message || "Could not update your email.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="request-help">
      <summary>Account & backup sign-in</summary>
      <div style={{ padding: 20 }}>
        <p>
          Your requests stay with this account. Cellphone:{" "}
          {user.phone || "Not linked"}.
        </p>
        <p>
          Add and verify a backup email here. Then either a texted code or an
          emailed code will open this same account, with the same requests and
          approval access.
        </p>
        <form onSubmit={save}>
          <label className="field">
            <span>Backup email</span>
            <input
              type="email"
              required
              maxLength={254}
              value={email}
              disabled={busy || sent}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {sent && (
            <label className="field">
              <span>Email confirmation code</span>
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,8}"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          )}
          <button className="secondary" disabled={busy}>
            {busy
              ? "Please wait…"
              : sent
                ? "Verify email"
                : "Save & verify email"}
          </button>
          {sent && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setSent(false);
                setCode("");
              }}
            >
              Change email or resend
            </button>
          )}
        </form>
        {user.email_confirmed_at && <p>Verified email: {user.email}</p>}
        {notice && <p role="status">{notice}</p>}
      </div>
    </details>
  );
}
