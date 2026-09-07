import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  ReceiptText,
  ShieldCheck,
  Upload,
  Check,
  FileCheck2,
  Plus,
  Clock,
  LogOut,
  RefreshCw,
  Download,
  Printer,
} from "lucide-react";
import { COMMITTEES } from "../committee/data.js";
import {
  STATUS,
  dollars,
  today,
  validateDraft,
  validateFiles,
  toCents,
  newDraft,
  newItem,
  fromRecord,
  actionAllowed,
} from "./model.js";
import {
  supabase,
  loadRequests,
  loadStaff,
  submit,
  act,
  details,
  receiptUrl,
} from "./api.js";
import "./requests.css";

const dateLabel = (value) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const Badge = ({ status }) => (
  <span className={`badge ${status}`}>{STATUS[status] || status}</span>
);
const Field = ({ label, full, children, ...props }) => (
  <label className={full ? "full" : ""}>
    {label}
    {children || <input {...props} />}
  </label>
);
function Guide() {
  return (
    <aside>
      <div className="summary-card">
        <p className="eyebrow">BEFORE YOU SUBMIT</p>
        <h2>A complete request moves things along.</h2>
        <ul>
          <li>
            <ReceiptText />
            <div>
              <strong>Include every receipt</strong>
              <p>Upload a clear photo or PDF for each expense.</p>
            </div>
          </li>
          <li>
            <ShieldCheck />
            <div>
              <strong>Approval stays attached</strong>
              <p>Your overseeing board member reviews the request here.</p>
            </div>
          </li>
          <li>
            <FileCheck2 />
            <div>
              <strong>Follow its progress</strong>
              <p>
                See when your request is reviewed and when payment is recorded.
              </p>
            </div>
          </li>
        </ul>
        <div className="policy">
          <strong>Reimbursements, not advances.</strong>
          <p>
            Committee funds are not advanced. Documentation and approval are
            required for reimbursement.
          </p>
        </div>
      </div>
    </aside>
  );
}
function SignIn({ onError }) {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  async function send(e) {
    e.preventDefault();
    setBusy(true);
    onError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      onError(
        /rate limit|once every/i.test(e.message)
          ? "Please wait a minute before requesting another code."
          : e.message || "We could not send a sign-in code. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    onError("");
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
    } catch {
      onError("That code did not work. Check the code or request another one.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="signin-callout">
      <ShieldCheck size={25} />
      <div>
        <strong>Sign in to submit and track your request</strong>
        <p>Use the email you use with RCAP. We’ll send you a sign-in code.</p>
      </div>
      <form className="signin-form full" onSubmit={sent ? verify : send}>
        <div className="fields">
          <Field
            label="Email address"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
            value={email}
            disabled={sent}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          {sent && (
            <Field
              label="Sign-in code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,8}"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          )}
        </div>
        <div className="actions">
          <button className="primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : sent
                ? "Verify & continue"
                : "Send sign-in code"}
            <ArrowRight size={16} />
          </button>
          {sent && (
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setCode("");
              }}
            >
              Change email or resend
            </button>
          )}
        </div>
        {sent && (
          <p role="status">Check your inbox and spam folder for your code.</p>
        )}
      </form>
    </div>
  );
}
function RequestForm({
  draft,
  setDraft,
  user,
  staff,
  onSaved,
  onError,
  busy,
  setBusy,
}) {
  const [progress, setProgress] = useState("");
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const setItem = (index, key, value) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    }));
  const total = draft.items.reduce(
    (sum, i) => sum + (toCents(i.amount) || 0),
    0,
  );
  async function save(e) {
    e.preventDefault();
    onError("");
    const error = validateDraft(draft);
    if (error) {
      onError(error);
      return;
    }
    if (!user) {
      onError("Sign in before submitting your request.");
      return;
    }
    setBusy(true);
    try {
      onSaved(await submit(draft, user, setProgress));
    } catch (e) {
      onError(
        e.message || "Your request could not be saved. Please try again.",
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <div className="workspace">
      <section className="form-card">
        <div className="card-heading">
          <span className="step-number">01</span>
          <div>
            <h2>{draft.version ? "Update your request" : "Your request"}</h2>
            <p>All fields are required unless marked optional.</p>
          </div>
          <ReceiptText size={27} />
        </div>
        <form onSubmit={save}>
          <fieldset
            disabled={busy}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            <div className="fields">
              <Field
                label="Your full name"
                required
                autoComplete="name"
                maxLength={100}
                value={draft.requester_name}
                onChange={(e) => set("requester_name", e.target.value)}
                placeholder="First and last name"
              />
              <Field
                label="Phone number"
                required
                type="tel"
                autoComplete="tel"
                value={draft.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="(404) 555-0123"
              />
              <Field
                label="Check payable to"
                required
                maxLength={150}
                value={draft.payee}
                onChange={(e) => set("payee", e.target.value)}
                placeholder="Name on the check"
              />
              <Field label="Committee">
                <select
                  required
                  value={draft.committee}
                  onChange={(e) => set("committee", e.target.value)}
                >
                  <option value="">Select a committee</option>
                  {COMMITTEES.map((c) => (
                    <option key={c.id}>{c.name}</option>
                  ))}
                  <option>General RCAP</option>
                  <option>Other RCAP expense</option>
                </select>
              </Field>
              <Field label="Check delivery">
                <select
                  value={draft.delivery}
                  onChange={(e) => set("delivery", e.target.value)}
                >
                  <option value="pickup">Coordinate pickup</option>
                  <option value="mail">Mail the check</option>
                </select>
              </Field>
              <Field label="Overseeing board member (optional)">
                <select
                  value={draft.approver_email}
                  disabled={!!draft.version}
                  onChange={(e) => set("approver_email", e.target.value)}
                >
                  <option value="">Let the secretary route it</option>
                  {staff
                    .filter((s) => s.email !== user?.email)
                    .map((s) => (
                      <option key={s.email} value={s.email}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </Field>
              {draft.delivery === "mail" && (
                <Field full label="Mailing address">
                  <textarea
                    required
                    maxLength={500}
                    value={draft.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="Street address, city, state, and ZIP code"
                    autoComplete="street-address"
                  />
                </Field>
              )}
              <Field full label="What were these expenses for?">
                <textarea
                  required
                  minLength={10}
                  maxLength={2000}
                  value={draft.purpose}
                  onChange={(e) => set("purpose", e.target.value)}
                  placeholder="Include the event or activity and how the purchases were used."
                />
              </Field>
            </div>
            <div className="form-section">
              <div className="card-heading">
                <span className="step-number">02</span>
                <div>
                  <h2>Expenses & receipts</h2>
                  <p>
                    Add a receipt to every expense. PDF, JPG, or PNG, up to 10
                    MB each.
                  </p>
                </div>
              </div>
              {draft.items.map((item, i) => (
                <div className="expense" key={item.key}>
                  <div className="expense-head">
                    <strong>Expense {i + 1}</strong>
                    {draft.items.length > 1 && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() =>
                          set(
                            "items",
                            draft.items.filter((_, j) => j !== i),
                          )
                        }
                      >
                        Remove expense
                      </button>
                    )}
                  </div>
                  <div className="fields">
                    <Field
                      label="Purchase date"
                      type="date"
                      required
                      max={today()}
                      value={item.date}
                      onChange={(e) => setItem(i, "date", e.target.value)}
                    />
                    <Field
                      label="Amount (USD)"
                      required
                      inputMode="decimal"
                      pattern="[0-9]+(\.[0-9]{1,2})?"
                      value={item.amount}
                      onChange={(e) => setItem(i, "amount", e.target.value)}
                      placeholder="0.00"
                    />
                    <Field
                      full
                      label="Merchant & expense description"
                      required
                      maxLength={300}
                      value={item.description}
                      onChange={(e) =>
                        setItem(i, "description", e.target.value)
                      }
                      placeholder="e.g. Grocery store, supplies for the event"
                    />
                  </div>
                  <div className="upload">
                    <label>
                      <span>
                        <Upload size={16} /> Attach receipts
                      </span>
                      <input
                        aria-label={`Upload receipts for expense ${i + 1}`}
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        multiple
                        onChange={(e) => {
                          const files = [...e.target.files];
                          const error = validateFiles(files);
                          if (error) onError(error);
                          else {
                            setItem(
                              i,
                              "receipts",
                              files.map((file) => ({ file, name: file.name })),
                            );
                            onError("");
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {item.receipts.length > 0 ? (
                      <ul className="inline-list">
                        {item.receipts.map((r, j) => (
                          <li key={j}>
                            <span>
                              <Check size={14} /> {r.name}
                            </span>
                            <button
                              className="text-button"
                              type="button"
                              onClick={() =>
                                setItem(
                                  i,
                                  "receipts",
                                  item.receipts.filter((_, k) => k !== j),
                                )
                              }
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">
                        At least one receipt is required for this expense.
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="secondary"
                style={{ marginTop: 18 }}
                disabled={draft.items.length >= 20}
                onClick={() => set("items", [...draft.items, newItem()])}
              >
                <Plus size={16} /> Add expense
              </button>
              <div className="total">
                <span>Total requested</span>
                <strong className="money">{dollars(total)}</strong>
              </div>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                required
                checked={draft.acknowledged}
                onChange={(e) => set("acknowledged", e.target.checked)}
              />
              <span>
                I confirm these expenses were incurred for RCAP, have not
                already been reimbursed, and the attached receipts support this
                request. I understand that board approval is required and
                committee funds are not advanced.
              </span>
            </label>
            {user && (
              <div className="actions">
                <span className="muted">Submitting as {user.email}</span>
                <button className="primary" disabled={busy}>
                  {busy
                    ? progress
                    : draft.version
                      ? "Resubmit for approval"
                      : "Submit request"}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </fieldset>
        </form>
        {!user && <SignIn onError={onError} />}
      </section>
      <Guide />
    </div>
  );
}
function RequestList({ records, board, onSelect, onNew, loading, onRefresh }) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const shown = records.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      `${r.reference} ${r.requester_name} ${r.payee} ${r.committee}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="stats">
        {[
          [
            "Awaiting review",
            records.filter((r) => r.status === "submitted").length,
          ],
          [
            "Approved, unpaid",
            dollars(
              records
                .filter((r) => r.status === "approved")
                .reduce((n, r) => n + r.total_cents, 0),
            ),
          ],
          ["Requests", records.length],
        ].map(([label, value]) => (
          <div className="stat" key={label}>
            <span className="muted">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="list-toolbar">
        <label className="sr-only" htmlFor="search">
          Search requests
        </label>
        <input
          id="search"
          placeholder="Search name, committee, or request number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="sr-only" htmlFor="filter">
          Filter by status
        </label>
        <select
          id="filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button className="secondary" disabled={loading} onClick={onRefresh}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      {loading ? (
        <p role="status">Loading requests…</p>
      ) : shown.length === 0 ? (
        <div className="empty">
          <ReceiptText size={40} />
          <h2>
            {search || filter !== "all"
              ? "No matching requests"
              : board
                ? "Your review queue is clear"
                : "Your requests will appear here"}
          </h2>
          <p className="muted">
            {board
              ? "New requests and their receipts will be ready for review here."
              : "Submit a request to follow its approval and payment status."}
          </p>
          {!board && (
            <button className="primary" onClick={onNew}>
              New request <Plus size={16} />
            </button>
          )}
        </div>
      ) : (
        shown.map((r) => (
          <button
            key={r.id}
            className="record-card record-button"
            onClick={() => onSelect(r.id)}
          >
            <div>
              <p>
                REQUEST #{r.reference} ·{" "}
                {new Date(r.created_at).toLocaleDateString()}
              </p>
              <h3>{r.payee}</h3>
              <p>
                {r.committee}
                {board ? ` · ${r.requester_name}` : ""}
              </p>
            </div>
            <Badge status={r.status} />
            <strong className="money">{dollars(r.total_cents)}</strong>
            <ArrowRight size={18} />
          </button>
        ))
      )}
    </>
  );
}
function Detail({
  record: r,
  role,
  user,
  staff,
  onBack,
  onError,
  onUpdate,
  onEdit,
}) {
  const [extra, setExtra] = useState({ history: [], notifications: [] }),
    [loading, setLoading] = useState(true),
    [note, setNote] = useState(""),
    [approver, setApprover] = useState(r.approver_email || ""),
    [payment, setPayment] = useState(""),
    [paymentDate, setPaymentDate] = useState(today()),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    const load = () =>
      details(r.id)
        .then((d) => {
          if (live) setExtra(d);
        })
        .catch((e) => {
          if (live) onError(e.message);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    load();
    const timer = setInterval(load, 10000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [r.id, r.version]);
  const allowed = (a) => actionAllowed(r, role, user.email, a);
  async function change(a) {
    setBusy(true);
    onError("");
    try {
      const updated = await act(a, {
        id: r.id,
        version: r.version,
        note,
        approver_email: approver,
        payment_reference: payment,
        payment_date: paymentDate,
      });
      setNote("");
      onUpdate(updated);
    } catch (e) {
      onError(e.message || "The update could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  async function openReceipt(receipt) {
    try {
      const url = await receiptUrl(receipt.path);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
    } catch {
      onError("The receipt could not be opened. Please try again.");
    }
  }
  return (
    <>
      <div className="actions no-print" style={{ margin: "0 0 22px" }}>
        <button className="secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back to requests
        </button>
        <button className="secondary" onClick={() => window.print()}>
          <Printer size={16} /> Print request
        </button>
        {allowed("edit") && (
          <button className="primary" onClick={() => onEdit(r)}>
            Update & resubmit <ArrowRight size={16} />
          </button>
        )}
      </div>
      <div className="review-grid">
        <section className="form-card">
          <div className="detail-head">
            <div>
              <p className="eyebrow">REQUEST #{r.reference}</p>
              <h2>{r.payee}</h2>
            </div>
            <Badge status={r.status} />
          </div>
          <dl className="details-grid">
            <div>
              <dt>Requested by</dt>
              <dd>
                {r.requester_name}
                <br />
                {r.email}
                <br />
                {r.phone}
              </dd>
            </div>
            <div>
              <dt>Committee</dt>
              <dd>{r.committee}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{r.delivery === "mail" ? r.address : "Coordinate pickup"}</dd>
            </div>
            <div>
              <dt>Overseeing board member</dt>
              <dd>
                {staff.find((s) => s.email === r.approver_email)?.name ||
                  "Awaiting assignment"}
              </dd>
            </div>
            <div className="full">
              <dt>Purpose</dt>
              <dd>{r.purpose}</dd>
            </div>
          </dl>
          <div className="form-section">
            <h2>Expenses & receipts</h2>
            {r.items.map((item, i) => (
              <div className="expense" key={i}>
                <div className="detail-head">
                  <strong>{item.description}</strong>
                  <strong>{dollars(item.amount_cents)}</strong>
                </div>
                <p className="muted">Purchased {item.date}</p>
                <div className="actions">
                  {item.receipts.map((receipt) => (
                    <button
                      key={receipt.path}
                      className="secondary"
                      onClick={() => openReceipt(receipt)}
                    >
                      <Download size={15} />
                      {receipt.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="total">
              <span>Total requested</span>
              <strong>{dollars(r.total_cents)}</strong>
            </div>
            {r.status === "paid" && (
              <p className="notice">
                Payment recorded on {r.payment_date}. Reference:{" "}
                {r.payment_reference}.
              </p>
            )}
          </div>
          <div className="form-section">
            <h2>Request history</h2>
            {loading ? (
              <p>Loading history…</p>
            ) : (
              <ol className="history">
                {extra.history.map((h) => (
                  <li key={h.id}>
                    <strong>{h.action.replaceAll("_", " ")}</strong>
                    <p>
                      {h.actor_email} · {dateLabel(h.created_at)}
                    </p>
                    {h.note && <p>{h.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
        <aside>
          <section className="summary-card">
            <h2>
              {r.status === "paid"
                ? "Payment recorded"
                : r.status === "approved"
                  ? "Ready for the treasurer"
                  : r.status === "needs_changes"
                    ? "A correction is needed"
                    : r.status === "declined"
                      ? "Request declined"
                      : "Review & next steps"}
            </h2>
            <p className="muted">
              {r.status === "submitted"
                ? "The assigned board member reviews the receipts and confirms approval here."
                : r.status === "approved"
                  ? "Board approval is complete. Payment is recorded separately by the treasurer."
                  : r.status === "needs_changes"
                    ? "Read the reviewer’s note, then update and resubmit this request."
                    : "The complete record and its receipts remain available here."}
            </p>
            {allowed("assign") && (
              <>
                <Field label="Assign overseeing board member">
                  <select
                    value={approver}
                    onChange={(e) => setApprover(e.target.value)}
                  >
                    <option value="">Choose a board member</option>
                    {staff
                      .filter((s) => s.email !== r.email)
                      .map((s) => (
                        <option key={s.email} value={s.email}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <button
                  className="secondary"
                  style={{ marginTop: 12 }}
                  disabled={busy || !approver}
                  onClick={() => change("assign")}
                >
                  Save assignment
                </button>
              </>
            )}
            {["approved", "needs_changes", "paid"].some(allowed) && (
              <div className="form-section">
                <Field label="Review note">
                  <textarea
                    maxLength={2000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Explain any correction or decision."
                  />
                </Field>
                {allowed("paid") && (
                  <div className="fields" style={{ marginTop: 20 }}>
                    <Field
                      full
                      label="Check or payment reference"
                      value={payment}
                      maxLength={100}
                      onChange={(e) => setPayment(e.target.value)}
                    />
                    <Field
                      full
                      label="Payment date"
                      type="date"
                      max={today()}
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                )}
                <div className="actions">
                  {allowed("approved") && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => change("approved")}
                    >
                      <Check size={16} /> Approve request
                    </button>
                  )}
                  {allowed("needs_changes") && (
                    <button
                      className="secondary"
                      disabled={busy || note.trim().length < 5}
                      onClick={() => change("needs_changes")}
                    >
                      Request changes
                    </button>
                  )}
                  {allowed("declined") && (
                    <button
                      className="danger"
                      disabled={busy || note.trim().length < 5}
                      onClick={() => change("declined")}
                    >
                      Decline
                    </button>
                  )}
                  {allowed("paid") && (
                    <button
                      className="primary"
                      disabled={busy || !payment.trim() || !paymentDate}
                      onClick={() => change("paid")}
                    >
                      Record payment
                    </button>
                  )}
                </div>
                <p className="muted">
                  Changes are recorded with your account and the time of your
                  decision.
                </p>
              </div>
            )}
          </section>
          <section className="record-card" style={{ marginTop: 20 }}>
            <h3>Email updates</h3>
            {loading ? (
              <p>Loading delivery status…</p>
            ) : extra.notifications.length ? (
              <>
                <p>Updates are queued automatically when a request changes.</p>
                <ul className="inline-list">
                  {extra.notifications.slice(0, 8).map((n) => (
                    <li key={n.id}>
                      <span style={{ overflowWrap: "anywhere", fontSize: 14 }}>
                        {n.recipient}
                      </span>
                      <span className="badge">
                        {n.state === "sent"
                          ? "Sent"
                          : n.state === "failed"
                            ? "Retry needed"
                            : n.state === "sending"
                              ? "Sending"
                              : "Queued"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>No email updates to show yet.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
function Staff({ staff, onRefresh, onError }) {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("approver"),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    onError("");
    try {
      await act("staff", { name, email, role });
      setName("");
      setEmail("");
      await onRefresh();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-card admin-panel">
      <h2>Board access</h2>
      <p className="muted">
        Add the email each board member uses to sign in. Assigned reviewers see
        their requests; secretary and treasurer accounts see the full queue.
      </p>
      <ul className="inline-list">
        {staff.map((s) => (
          <li key={s.email}>
            <span>
              <strong>{s.name}</strong>
              <br />
              <span className="muted">{s.email}</span>
            </span>
            <span className="badge">{s.role}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={save}>
        <div className="fields">
          <Field
            label="Full name"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Sign-in email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field label="Board role">
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="approver">Overseeing board member</option>
              <option value="secretary">Secretary</option>
              <option value="treasurer">Treasurer</option>
            </select>
          </Field>
        </div>
        <div className="actions">
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Add or update board access"}
          </button>
        </div>
      </form>
    </section>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [authLoading, setAuthLoading] = useState(true),
    [tab, setTab] = useState("new"),
    [draft, setDraft] = useState(newDraft),
    [records, setRecords] = useState([]),
    [staff, setStaff] = useState([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(
      () => location.hash.match(/^#request\/([0-9a-f-]{36})$/)?.[1] || null,
    );
  const errorRef = useRef(null);
  useEffect(() => {
    if (error)
      errorRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "center",
      });
  }, [error]);
  const role = staff.find((s) => s.email === user?.email?.toLowerCase())?.role;
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error)
        setError("We could not restore your sign-in. Please sign in again.");
      setUser(data.session?.user || null);
      setAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
      setAuthLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [r, s] = await Promise.all([loadRequests(), loadStaff()]);
      setRecords(r);
      setStaff(s);
    } catch (e) {
      setError(
        "We could not load your requests. Please refresh and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    if (user) {
      refresh();
    } else {
      setRecords([]);
      setStaff([]);
    }
  }, [user, refresh]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [user, refresh]);
  useEffect(() => {
    const change = () =>
      setSelected(
        location.hash.match(/^#request\/([0-9a-f-]{36})$/)?.[1] || null,
      );
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  function navigate(next) {
    setTab(next);
    setSelected(null);
    history.replaceState(null, "", location.pathname);
    setError("");
    setNotice("");
  }
  function select(id) {
    setSelected(id);
    location.hash = `request/${id}`;
    setError("");
  }
  function update(r) {
    setRecords((a) => [r, ...a.filter((x) => x.id !== r.id)]);
    setNotice("Request updated. Email updates have been queued.");
    refresh();
  }
  function saved(r) {
    update(r);
    setDraft(newDraft());
    setNotice(
      `Request #${r.reference} submitted. Your receipts and request are saved, and email updates are queued.`,
    );
    select(r.id);
    setTab("mine");
  }
  async function signOut() {
    if (busy) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError("Could not sign out. Please try again.");
      return;
    }
    setDraft(newDraft());
    setRecords([]);
    setStaff([]);
    navigate("new");
  }
  const current = records.find((r) => r.id === selected);
  return (
    <div className="cr">
      <header>
        <a className="brand" href="/">
          RCA<span>P</span>
        </a>
        <span className="header-label">PARENT RESOURCES</span>
        <a href="/">
          Back to RCAP <ArrowRight size={16} />
        </a>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">RCAP FINANCE</p>
            <h1>Check requests.</h1>
            <p>Submit your expenses. Keep everything together.</p>
          </div>
          <span className="private-label">
            <ShieldCheck size={18} /> Private & secure
          </span>
        </div>
        <nav className="tabs" aria-label="Check request sections">
          {[
            ["new", "New request"],
            ["mine", "My requests"],
            ["board", "Board review"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-current={tab === key ? "page" : undefined}
              className={tab === key ? "active" : ""}
              onClick={() => navigate(key)}
            >
              {label}
            </button>
          ))}
          {user && (
            <button
              style={{ marginLeft: "auto" }}
              disabled={busy}
              onClick={signOut}
            >
              <LogOut size={14} /> Sign out
            </button>
          )}
        </nav>
        {error && (
          <div ref={errorRef} className="notice error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {authLoading ? (
          <p role="status">Checking your sign-in…</p>
        ) : selected && user ? (
          current ? (
            <Detail
              key={current.id}
              record={current}
              role={role}
              user={user}
              staff={staff}
              onBack={() => navigate(role ? "board" : "mine")}
              onError={setError}
              onUpdate={update}
              onEdit={(r) => {
                setDraft(fromRecord(r));
                navigate("new");
              }}
            />
          ) : loading ? (
            <p>Loading request…</p>
          ) : (
            <div className="empty">
              <h2>Request unavailable</h2>
              <p>
                It may belong to another account. Sign in with the email used
                for this request.
              </p>
              <button className="secondary" onClick={() => navigate("mine")}>
                Back to my requests
              </button>
            </div>
          )
        ) : tab === "new" ? (
          <RequestForm
            draft={draft}
            setDraft={setDraft}
            user={user}
            staff={staff}
            onSaved={saved}
            onError={setError}
            busy={busy}
            setBusy={setBusy}
          />
        ) : !user ? (
          <div className="workspace">
            <section className="form-card">
              <h2>{tab === "board" ? "Board review" : "Your requests"}</h2>
              <p className="muted">
                {tab === "board"
                  ? "Use the email assigned to your board role to review requests and receipts."
                  : "Sign in to see your requests, reviewer notes, and payment status."}
              </p>
              <SignIn onError={setError} />
            </section>
            <Guide />
          </div>
        ) : tab === "board" && !role ? (
          <div className="empty">
            <ShieldCheck size={35} />
            <h2>Board access is needed</h2>
            <p className="muted">
              The secretary can add your sign-in email in Board access.
            </p>
            <p>{user.email}</p>
            <button className="secondary" onClick={() => navigate("mine")}>
              View my requests
            </button>
          </div>
        ) : (
          <>
            <RequestList
              records={
                tab === "mine"
                  ? records.filter((r) => r.owner_id === user.id)
                  : records
              }
              board={tab === "board"}
              onSelect={select}
              onNew={() => navigate("new")}
              loading={loading}
              onRefresh={refresh}
            />
            {tab === "board" && ["secretary", "manager"].includes(role) && (
              <Staff staff={staff} onRefresh={refresh} onError={setError} />
            )}
          </>
        )}
      </main>
      <footer>
        Ron Clark Academy Parents{" "}
        <span>
          Questions?{" "}
          <a href="mailto:rcaparents@ronclarkacademy.com">Contact RCAP</a>
        </span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
