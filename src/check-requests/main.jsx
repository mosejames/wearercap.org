import Brand from "../components/Brand.jsx";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  ArrowDown,
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
  ExternalLink,
  Printer,
} from "lucide-react";
import { COMMITTEES } from "../committee/data.js";
import {
  STATUS,
  dollars,
  today,
  validateDraft,
  addReceipts,
  toCents,
  newDraft,
  newItem,
  fromRecord,
  actionAllowed,
  assignedReviewer,
  voters,
  tally,
  milestones,
  phoneIdentity,
  contactOf,
  normalizePhone,
  validZelle,
} from "./model.js";
import {
  supabase,
  loadRequests,
  loadStaff,
  submit,
  act,
  details,
  archiveUrl,
} from "./api.js";
import "./requests.css";
import NotificationPreferences from "./NotificationPreferences.jsx";
import Account from "./Account.jsx";
import PdfDownloads from "./PdfDownloads.jsx";
import ReceiptThumbs from "./ReceiptThumbs.jsx";
import ApprovalRecipients from "./ApprovalRecipients.jsx";
import { financeArchive, saveFinanceArchive } from "./export.js";
import ApprovalRouting from "./ApprovalRouting.jsx";

// A bare YYYY-MM-DD (payment date) is a calendar day, not an instant; parsing
// it as UTC midnight would show the day before in Atlanta.
const dayLabel = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const dateLabel = (value) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const HISTORY_LABEL = {
  submitted: "Submitted",
  resubmitted: "Resubmitted",
  approved: "Approved",
  declined: "Declined",
  needs_changes: "Sent back for changes",
  board_review: "Sent to the board",
  vote_approve: "Voted yes",
  vote_decline: "Voted no",
  duplicate: "Closed as duplicate",
  paid: "Funds released",
  assigned: "Assigned",
  reassigned: "Approver changed",
  archived: "Archived",
  restored: "Restored",
};
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
              <strong>Include supporting documents</strong>
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
            Committee funds are not advanced. Expenses must be within budget.
            Paid receipts or vendor invoices and assigned Board Member approval
            are required for payment. Approval happens within this form.
          </p>
        </div>
      </div>
    </aside>
  );
}
export function SignIn({ onError, allowEmail = true }) {
  const [emailMode, setEmailMode] = useState(false);
  const [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  async function send(e) {
    e.preventDefault();
    if (!emailMode && !phoneIdentity(phone)) {
      onError("Enter your 10-digit US cellphone number.");
      return;
    }
    setBusy(true);
    onError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        ...(emailMode
          ? { email: phone.trim().toLowerCase() }
          : { phone: phoneIdentity(phone) }),
        options: {
          shouldCreateUser: !emailMode,
          ...(emailMode ? {} : { channel: "sms" }),
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      onError(
        /rate limit|once every/i.test(e.message)
          ? "Please wait a minute before requesting another code."
          : emailMode
            ? "We could not send an email code. Use cellphone sign-in, then add and verify your backup email under Account & backup sign-in."
            : e.message || "We could not send a sign-in code. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verify(e) {
    e.preventDefault();
    if (!emailMode && !phoneIdentity(phone)) {
      onError("Enter your 10-digit US cellphone number.");
      return;
    }
    setBusy(true);
    onError("");
    try {
      const { error } = await supabase.auth.verifyOtp({
        ...(emailMode
          ? { email: phone.trim().toLowerCase() }
          : { phone: phoneIdentity(phone) }),
        token: code.trim(),
        type: emailMode ? "email" : "sms",
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
        <p>
          {emailMode
            ? "Use the backup email you added and verified under Account & backup sign-in. Existing email accounts can also sign in here."
            : "Enter your cellphone number. We’ll text you a verification code. No email or password needed."}
        </p>
      </div>
      <form className="signin-form full" onSubmit={sent ? verify : send}>
        <div className="fields">
          <Field
            label={emailMode ? "Verified backup email" : "Cellphone number"}
            type={emailMode ? "email" : "tel"}
            required
            autoComplete={emailMode ? "email" : "tel"}
            maxLength={emailMode ? 254 : 20}
            value={phone}
            disabled={sent}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={emailMode ? "you@example.com" : "(404) 555-0123"}
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
                : emailMode
                  ? "Email me a code"
                  : "Text me a code"}
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
              Change details or resend
            </button>
          )}
        </div>
        {sent && (
          <p role="status">
            {emailMode
              ? "Check your inbox for your verification code."
              : "Check your text messages for your verification code."}
          </p>
        )}
        {allowEmail && (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => {
              setEmailMode(!emailMode);
              setPhone("");
              setCode("");
              setSent(false);
              onError("");
            }}
          >
            {emailMode ? "Use cellphone instead" : "Use verified backup email"}
          </button>
        )}
      </form>
    </div>
  );
}
export function RequestForm({
  draft,
  setDraft,
  user,
  staff,
  onSaved,
  onError,
  busy,
  setBusy,
}) {
  const preparing = !!draft.on_behalf;
  const [progress, setProgress] = useState("");
  const [step, setStep] = useState(0);
  const headingRef = useRef(null);
  const previousStep = useRef(step);
  const stepNames = [
    "Request details",
    "Expenses & documents",
    "Review & submit",
  ];
  function goStep(next) {
    setStep(next);
    onError("");
  }
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    });
  }, [step]);
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
    if (step === 0) {
      if (
        draft.on_behalf &&
        (!draft.approver_email || !validZelle(draft.payee_contact))
      ) {
        onError("Choose an approver and enter the payee email or cellphone.");
        return;
      }
      if (!/^\d{10}$/.test(normalizePhone(draft.phone))) {
        onError("Enter a 10-digit phone number.");
        return;
      }
      if (draft.delivery === "zelle" && !validZelle(draft.zelle_contact)) {
        onError("Enter the email or cellphone registered with Zelle.");
        return;
      }
      goStep(1);
      return;
    }
    if (step === 1) {
      const expenseError = draft.items.some(
        (item) =>
          !item.receipts.length ||
          (toCents(item.amount) < toCents(item.document_total) &&
            (item.coverage_note || "").trim().length < 10) ||
          toCents(item.amount) === null ||
          toCents(item.document_total) === null ||
          toCents(item.amount) > toCents(item.document_total),
      );
      if (expenseError) {
        onError(
          "Add supporting documents, a supported requested amount, and an explanation for any amount RCAP is not covering.",
        );
        return;
      }
      goStep(2);
      return;
    }
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
      onSaved(await submit(draft, user, setProgress, preparing));
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
    <div className="workspace request-wizard">
      <section className="form-card">
        <ol className="form-steps" aria-label="Request progress">
          {stepNames.map((name, index) => (
            <li
              key={name}
              aria-current={step === index ? "step" : undefined}
              className={
                step === index ? "current" : index < step ? "complete" : ""
              }
            >
              <span>{index < step ? <Check size={16} /> : index + 1}</span>
              <strong>{name}</strong>
            </li>
          ))}
        </ol>
        <div className="card-heading" ref={headingRef} tabIndex={-1}>
          <span className="step-number">0{step + 1}</span>
          <div>
            <h2>{stepNames[step]}</h2>
            <p>
              {
                [
                  "Tell us who to pay and what the expenses were for.",
                  "Add each expense and its paid receipt or vendor invoice.",
                  "Check your details, then send your request for approval.",
                ][step]
              }
            </p>
          </div>
          <ReceiptText size={27} />
        </div>
        <form onSubmit={save}>
          <fieldset
            disabled={busy}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            <fieldset
              className="wizard-panel"
              hidden={step !== 0}
              disabled={step !== 0}
            >
              <p className="muted">
                All fields are required unless marked optional.
              </p>
              {draft.on_behalf && (
                <p className="notice">
                  You prepare the request, the assigned board member approves,
                  and the treasurer records payment. Enter the recipient below.
                  An email contact also receives the approval confirmation. This
                  does not create an account for the payee.
                </p>
              )}
              <div className="fields">
                <Field
                  label={
                    draft.on_behalf
                      ? "Prepared by (your full name)"
                      : "Your full name"
                  }
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
                <Field label="Request type">
                  <select
                    value={draft.request_type}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        request_type: e.target.value,
                        delivery: "zelle",
                        acknowledged: false,
                      }))
                    }
                  >
                    <option value="reimbursement">Reimbursement</option>
                    <option value="vendor">Direct payment to vendor</option>
                  </select>
                </Field>
                <Field
                  label={
                    draft.request_type === "vendor"
                      ? "Vendor name"
                      : "Payee full name"
                  }
                  required
                  maxLength={150}
                  value={draft.payee}
                  onChange={(e) => set("payee", e.target.value)}
                  placeholder="Person or vendor receiving payment"
                />
                {draft.on_behalf && (
                  <Field
                    label="Payee email or cellphone"
                    required
                    maxLength={254}
                    value={draft.payee_contact || ""}
                    onChange={(e) => set("payee_contact", e.target.value)}
                    placeholder="Contact for the person receiving payment"
                  />
                )}
                <Field
                  label="Event or activity (optional)"
                  maxLength={150}
                  value={draft.event_name || ""}
                  onChange={(e) => set("event_name", e.target.value)}
                  placeholder="e.g. Parent Social"
                />
                {draft.on_behalf && (
                  <Field label="Send approval request to">
                    <select
                      required
                      value={draft.approver_email}
                      onChange={(e) => set("approver_email", e.target.value)}
                    >
                      <option value="">
                        Choose an independent board member
                      </option>
                      {staff
                        .filter((s) => s.email !== contactOf(user))
                        .map((s) => (
                          <option key={s.email} value={s.email}>
                            {s.name} (
                            {s.email.startsWith("+") ? "text" : "email"})
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
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
                <Field label="How should the payee receive payment?">
                  <select
                    value={draft.delivery}
                    onChange={(e) => set("delivery", e.target.value)}
                  >
                    <option value="zelle">Zelle</option>
                    {draft.request_type === "vendor" && (
                      <option value="debit_card">
                        Debit card (vendor does not accept Zelle)
                      </option>
                    )}
                  </select>
                </Field>
                {draft.delivery === "debit_card" && (
                  <p className="muted">
                    The finance team will arrange the vendor card payment after
                    approval. Do not enter card details here.
                  </p>
                )}
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
                {draft.delivery === "zelle" && (
                  <Field
                    full
                    label="Email or cellphone number registered with Zelle"
                    required
                    maxLength={254}
                    value={draft.zelle_contact || ""}
                    onChange={(e) => set("zelle_contact", e.target.value)}
                    placeholder="Payee’s Zelle email or cellphone"
                  />
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
            </fieldset>
            <fieldset
              className="wizard-panel"
              hidden={step !== 1}
              disabled={step !== 1}
            >
              <div className="form-section">
                <div className="card-heading">
                  <span className="step-number">02</span>
                  <div>
                    <h2>Expenses & documents</h2>
                    <p>Add supporting documents to every expense.</p>
                  </div>
                </div>
                <p className="muted">
                  {draft.request_type === "vendor"
                    ? "Attach an unpaid invoice for every vendor expense."
                    : "Attach receipts showing payment completed, not just an order confirmation. Check Amazon and Walmart documents carefully."}{" "}
                  Identify the reimbursable items on the receipt. One
                  description is fine when the entire receipt is for one
                  expense. For partial reimbursement, list the covered items and
                  their amounts. PDF, JPG, or PNG, up to 10 MB each.
                </p>
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
                        label={
                          draft.request_type === "vendor"
                            ? "Invoice date"
                            : "Purchase date"
                        }
                        type="date"
                        required
                        max={today()}
                        value={item.date}
                        onChange={(e) => setItem(i, "date", e.target.value)}
                      />
                      <Field
                        label="Amount requested (USD)"
                        required
                        inputMode="decimal"
                        pattern="[0-9]+(\.[0-9]{1,2})?"
                        value={item.amount}
                        onChange={(e) => setItem(i, "amount", e.target.value)}
                        placeholder="0.00"
                      />
                      <Field
                        label={
                          draft.request_type === "vendor"
                            ? "Invoice total (USD)"
                            : "Paid receipt total (USD)"
                        }
                        required
                        inputMode="decimal"
                        pattern="[0-9]+(\.[0-9]{1,2})?"
                        value={item.document_total || ""}
                        onChange={(e) =>
                          setItem(i, "document_total", e.target.value)
                        }
                        placeholder="0.00"
                      />
                      {draft.request_type !== "vendor" && (
                        <Field
                          full
                          label="Store or vendor"
                          required
                          maxLength={150}
                          value={item.vendor || ""}
                          onChange={(e) => setItem(i, "vendor", e.target.value)}
                          placeholder="e.g. Party City, Walmart, Amazon"
                        />
                      )}
                      <Field
                        full
                        label="Covered items & amounts"
                        required
                        maxLength={300}
                        value={item.description}
                        onChange={(e) =>
                          setItem(i, "description", e.target.value)
                        }
                        placeholder="e.g. Candy and table covers for the social"
                      />
                    </div>
                    {toCents(item.amount) < toCents(item.document_total) && (
                      <div className="coverage-note">
                        <p>
                          <strong>
                            {dollars(
                              toCents(item.document_total) -
                                toCents(item.amount),
                            )}{" "}
                            is not requested from RCAP.
                          </strong>{" "}
                          The approved budget does not increase.
                        </p>
                        <Field full label="Who covers the difference, and how?">
                          <textarea
                            required
                            minLength={10}
                            maxLength={1000}
                            value={item.coverage_note || ""}
                            onChange={(e) =>
                              setItem(i, "coverage_note", e.target.value)
                            }
                            placeholder="Explain any personal contribution or excluded items. Include who covers each share and whether it is planned or already paid."
                          />
                        </Field>
                      </div>
                    )}
                    <div className="upload">
                      <label>
                        <span>
                          <Upload size={16} />{" "}
                          {item.receipts.length
                            ? "Add another file"
                            : draft.request_type === "vendor"
                              ? "Attach invoice"
                              : "Attach paid receipts"}
                        </span>
                        <input
                          aria-label={`Upload receipts for expense ${i + 1}`}
                          type="file"
                          accept="image/jpeg,image/png,application/pdf"
                          multiple
                          onChange={(e) => {
                            const result = addReceipts(item.receipts, [
                              ...e.target.files,
                            ]);
                            if (result.error) onError(result.error);
                            else {
                              setItem(i, "receipts", result.receipts);
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
                          At least one paid receipt or vendor invoice is
                          required for this expense.
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
            </fieldset>
            <fieldset
              className="wizard-panel"
              hidden={step !== 2}
              disabled={step !== 2}
            >
              <div className="review-summary">
                <div className="detail-head">
                  <h3>Your request</h3>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => goStep(0)}
                  >
                    Edit details
                  </button>
                </div>
                <dl className="details-grid">
                  <div>
                    <dt>{draft.on_behalf ? "Prepared by" : "Requested by"}</dt>
                    <dd>{draft.requester_name}</dd>
                  </div>
                  <div>
                    <dt>Request type</dt>
                    <dd>
                      {draft.request_type === "vendor"
                        ? "Direct payment to vendor"
                        : "Reimbursement"}
                    </dd>
                    <dt>Payee</dt>
                    <dd>{draft.payee}</dd>
                  </div>
                  <div>
                    <dt>Committee</dt>
                    <dd>{draft.committee}</dd>
                  </div>
                  <div>
                    <dt>Payment method</dt>
                    <dd>
                      {
                        {
                          mail: "Mail",
                          pickup: "Pickup at school",
                          zelle: "Zelle",
                          debit_card: "Vendor debit card payment",
                        }[draft.delivery]
                      }
                      {draft.delivery === "mail" && <p>{draft.address}</p>}
                      {draft.delivery === "zelle" && (
                        <p>{draft.zelle_contact}</p>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Contact number</dt>
                    <dd>{draft.phone}</dd>
                  </div>
                  <div>
                    <dt>Reviewed by</dt>
                    <dd>
                      {draft.on_behalf
                        ? staff.find((s) => s.email === draft.approver_email)?.name
                        : "Automatically assigned after submission"}
                    </dd>
                  </div>
                  <div className="full">
                    {draft.event_name && (
                      <>
                        <dt>Event</dt>
                        <dd>{draft.event_name}</dd>
                      </>
                    )}
                    <dt>Purpose</dt>
                    <dd>{draft.purpose}</dd>
                  </div>
                </dl>
                <div className="detail-head">
                  <h3>Expenses & documents</h3>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => goStep(1)}
                  >
                    Edit expenses
                  </button>
                </div>
                {draft.items.map((item, i) => (
                  <div className="expense" key={item.key}>
                    <div className="detail-head">
                      <strong>{item.description || `Expense ${i + 1}`}</strong>
                      <strong>{dollars(toCents(item.amount) || 0)}</strong>
                    </div>
                    <p className="muted">
                      {item.date} · {item.receipts.length} receipt
                      {item.receipts.length === 1 ? "" : "s"}
                    </p>
                    <p>
                      Document total:{" "}
                      {dollars(toCents(item.document_total) || 0)}. Requested
                      from RCAP: {dollars(toCents(item.amount) || 0)}.
                    </p>
                    {item.coverage_note && (
                      <p>Not requested from RCAP: {item.coverage_note}</p>
                    )}
                    <p className="muted">
                      {item.receipts.map((r) => r.name).join(", ")}
                    </p>
                  </div>
                ))}
                <div className="total">
                  <span>Total requested</span>
                  <strong>{dollars(total)}</strong>
                </div>
              </div>
              {preparing && (
                <ApprovalRecipients
                  value={draft.approval_recipients_text}
                  onChange={(people) =>
                    set("approval_recipients_text", people.join(", "))
                  }
                />
              )}
              {draft.on_behalf && (
                <p className="notice">
                  Approval will be requested from{" "}
                  <strong>
                    {staff.find((s) => s.email === draft.approver_email)
                      ?.name || "the selected board member"}
                  </strong>
                  . They receive a review link. No reply-all is needed.
                </p>
              )}
              <Field
                full
                label="Email me a PDF copy (optional)"
                type="email"
                maxLength={254}
                value={draft.archive_email || ""}
                onChange={(e) => set("archive_email", e.target.value)}
                placeholder="Your personal email address"
              />
              <p className="muted">
                A PDF with your request and receipts is emailed to RCAP for its
                records. Add your email above if you would like a copy too.
                Sign-in stays by cellphone.
              </p>
              <label className="check-row">
                <input
                  type="checkbox"
                  required
                  checked={draft.budget_confirmed}
                  onChange={(e) => set("budget_confirmed", e.target.checked)}
                />
                <span>
                  I confirm the amount requested from RCAP is within the
                  approved committee budget. Any remaining expense is explained
                  above and does not increase that budget. Approval will take
                  place through this form.
                </span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  required
                  checked={draft.acknowledged}
                  onChange={(e) => set("acknowledged", e.target.checked)}
                />
                <span>
                  {draft.request_type === "vendor"
                    ? "I confirm this invoice is for RCAP, remains unpaid, and the requested amount is supported by the invoice. The finance team will pay the vendor after Board Member approval."
                    : "I confirm these RCAP expenses have been paid, have not already been reimbursed, and the receipts show completed payment. I have identified the reimbursable items and amounts. An order confirmation alone is not proof of payment."}
                </span>
              </label>
            </fieldset>
            <div className="wizard-navigation">
              {step > 0 && (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => goStep(step - 1)}
                >
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              {step < 2 && (
                <button type="submit" className="primary" disabled={busy}>
                  Continue to {step === 0 ? "expenses" : "review"}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
            {user && step === 2 && (
              <div className="actions">
                <span className="muted">
                  Request updates go to {contactOf(user)}
                </span>
                <button className="primary" disabled={busy}>
                  {busy
                    ? progress
                    : draft.version
                      ? "Resubmit for approval"
                      : draft.on_behalf
                        ? `Send to ${staff.find((s) => s.email === draft.approver_email)?.name || "board member"} for approval`
                        : "Submit request"}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </fieldset>
        </form>
        {!user && step === 2 && <SignIn onError={onError} />}
      </section>
      <details className="request-help">
        <summary>Document requirements & payment policy</summary>
        <Guide />
      </details>
    </div>
  );
}
export function RequestList({
  records,
  board,
  onSelect,
  onNew,
  loading,
  onRefresh,
  contact,
  role,
  approvalsOnly = false,
  staff = [],
  user,
  onError,
  onUpdate,
  onEdit,
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(approvalsOnly ? "mine" : "all");
  const [expanded, setExpanded] = useState(null);
  const [exporting, setExporting] = useState("");
  async function exportAll() {
    try {
      setExporting("Loading records…");
      saveFinanceArchive(await financeArchive(setExporting));
      setExporting("");
    } catch (error) {
      setExporting("");
      onError(error.message || "Could not export the finance records.");
    }
  }
  const active = records.filter((r) => !r.archived_at);
  const mine = active.filter(
    (r) =>
      actionAllowed(r, role, contact, "approved") ||
      actionAllowed(r, role, contact, "vote", {
        canVote: voters(staff, r).includes(
          staff.find((s) => s.email === contact)?.name,
        ),
      }),
  );
  const pending = (r) => ["submitted", "board_review"].includes(r.status);
  const nameOf = (email) =>
    staff.find((s) => s.email === email)?.name || "Assigned reviewer";
  const next = (r) =>
    r.archived_at
      ? "Archived"
      : r.status === "approved"
        ? "Treasurer: record payment"
        : r.status === "needs_changes"
          ? "Requester: make corrections"
          : r.status === "board_review"
            ? "Board: vote"
            : r.status === "submitted"
              ? assignedReviewer(r)
                ? `${nameOf(r.approver_email)}: review`
                : "Treasurer: review"
              : "Complete";
  const shown = records.filter(
    (r) =>
      (filter === "archived" ? Boolean(r.archived_at) : !r.archived_at) &&
      (filter === "all" ||
        filter === "archived" ||
        (filter === "mine"
          ? mine.includes(r)
          : filter === "pending"
            ? pending(r)
            : filter === "awaiting_approval"
              ? assignedReviewer(r) && r.status === "submitted"
              : r.status === filter)) &&
      `${r.reference} ${r.requester_name} ${r.payee} ${r.committee} ${r.purpose} ${r.event_name || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="stats">
        {[
          ["Awaiting review", active.filter(pending).length, "pending"],
          [
            "Approved, unpaid",
            dollars(
              active
                .filter((r) => r.status === "approved")
                .reduce((n, r) => n + r.total_cents, 0),
            ),
            "approved",
          ],
          ["Active requests", active.length, "all"],
        ].map(([label, value, key]) => (
          <button
            type="button"
            className="stat"
            key={key}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            <span className="muted">{label}</span>
            <strong>{value}</strong>
            <span className="stat-action">
              {filter === key ? "Showing below" : "View requests below"}
              <ArrowDown size={15} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
      {board && (
        <section className="approval-banner">
          <div>
            <h2>Needs my approval ({mine.length})</h2>
            <p>
              {mine.length
                ? "Review the receipts and amount, then approve or request changes."
                : "You’re caught up. No requests need your approval."}
            </p>
          </div>
          <button className="secondary" onClick={() => setFilter("mine")}>
            View my approvals
          </button>
        </section>
      )}
      {board && ["treasurer", "secretary", "manager"].includes(role) && (
        <section className="finance-export">
          <div>
            <h2>Treasurer ledger</h2>
            <p>View requests, documents, and the full action history in a live, read-only Google Sheet. The ZIP is available for a dated copy.</p>
          </div>
          <div className="finance-export-actions">
            <a className="secondary" href="https://docs.google.com/spreadsheets/d/1M5XRQp56NytaV8bYh6-f4aotsg6J7v3raSfiiKmnRuI/edit" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} /> Open live ledger
            </a>
            <button type="button" className="secondary" disabled={!!exporting} onClick={exportAll}>
              <Download size={16} /> {exporting || "Download records ZIP"}
            </button>
          </div>
        </section>
      )}
      <div className="list-toolbar">
        <label className="sr-only" htmlFor="search">
          Search requests
        </label>
        <input
          id="search"
          placeholder="Search name, purpose, or request number"
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
          {board && <option value="mine">Needs my approval</option>}
          <option value="all">All active requests</option>
          <option value="pending">Pending approvals</option>
          {Object.entries(STATUS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
          <option value="archived">Archived</option>
        </select>
        <button className="secondary" disabled={loading} onClick={onRefresh}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      {loading && !records.length ? (
        <p role="status">Loading requests…</p>
      ) : !shown.length ? (
        <div className="empty">
          <h2>No matching requests</h2>
          <p>Choose another queue or search to find a request.</p>
          {!board && (
            <button className="primary" onClick={onNew}>
              New request
            </button>
          )}
        </div>
      ) : (
        shown.map((r) => (
          <article className="queue-item" key={r.id}>
            <div className="queue-row">
              <div>
                <p className="muted">
                  REQUEST #{r.reference} ·{" "}
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
                <h3>{r.payee}</h3>
                <p className="queue-purpose">{r.purpose}</p>
                <p className="muted">Next: {next(r)}</p>
              </div>
              <Badge status={assignedReviewer(r) && r.status === "submitted" ? "awaiting_approval" : r.status} />
              <strong className="money">{dollars(r.total_cents)}</strong>
              <button
                className={
                  pending(r) && !r.archived_at ? "primary" : "secondary"
                }
                aria-expanded={expanded === r.id}
                aria-controls={`review-${r.id}`}
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                {expanded === r.id
                  ? "Close"
                  : pending(r) && !r.archived_at
                    ? "Review"
                    : "View"}
              </button>
            </div>
            {expanded === r.id && (
              <div className="queue-expanded" id={`review-${r.id}`}>
                {user ? (
                  <Detail
                    record={r}
                    role={role}
                    user={user}
                    staff={staff}
                    onBack={() => setExpanded(null)}
                    onError={onError}
                    onUpdate={onUpdate}
                    onEdit={onEdit}
                  />
                ) : (
                  <button onClick={() => onSelect(r.id)}>Open request</button>
                )}
              </div>
            )}
          </article>
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
    [dupOf, setDupOf] = useState(""),
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
  const [approvalRecipients, setApprovalRecipients] = useState(
    r.approval_recipients || [],
  );
  const [approverChoice, setApproverChoice] = useState(r.approver_email || "");
  const [reassignReason, setReassignReason] = useState("");
  const me = contactOf(user);
  const myName = staff.find((s) => s.email === me)?.name;
  const eligible = voters(staff, r);
  const votes = tally(extra.history, staff, r);
  const allowed = (a) =>
    actionAllowed(r, role, me, a, {
      canVote: !!myName && eligible.includes(myName),
      ownerIsTreasurer: staff.some(
        (s) => s.email === r.email && s.role === "treasurer",
      ),
    });
  const nameOf = (email) => staff.find((s) => s.email === email)?.name || email;
  const canReassign =
    ["treasurer", "secretary", "manager"].includes(role) &&
    r.status === "submitted" &&
    !r.archived_at;
  const requesterName = staff.find((s) => s.email === r.email)?.name;
  const payeeName = staff.find((s) => s.email === r.payee_contact)?.name;
  const requesterIsTreasurer = staff.some(
    (person) => person.name === requesterName && person.role === "treasurer",
  );
  const reviewerOptions = [
    ...new Map(
      staff
        .filter(
          (person) =>
            ["board", "treasurer", "secretary", "manager"].includes(
              person.role,
            ) &&
            person.email !== r.email &&
            person.email !== r.payee_contact &&
            person.name !== requesterName &&
            (!r.on_behalf || person.name !== payeeName) &&
            (assignedReviewer(r) || person.role !== "treasurer"),
        )
        .sort(
          (a, b) =>
            Number(a.email.startsWith("+")) -
            Number(b.email.startsWith("+")),
        )
        .map((person) => [person.name, person]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  async function reassign(event) {
    event.preventDefault();
    setBusy(true);
    onError("");
    try {
      const { data, error } = await supabase.rpc("cr_reassign_approver", {
        p_id: r.id,
        p_version: r.version,
        p_approver: approverChoice,
        p_reason: reassignReason.trim(),
      });
      if (error) throw error;
      setReassignReason("");
      onUpdate(data);
    } catch (error) {
      onError(error.message || "Could not change the approver.");
    } finally {
      setBusy(false);
    }
  }
  async function change(a) {
    setBusy(true);
    onError("");
    try {
      const updated = await act(a, {
        id: r.id,
        version: r.version,
        note,
        ...(["approved", "vote_approve"].includes(a)
          ? {
              approval_recipients: approvalRecipients,
            }
          : {}),
        duplicate_of: dupOf,
        payment_reference: payment,
        payment_date: paymentDate,
      });
      setNote("");
      setDupOf("");
      onUpdate(updated);
    } catch (e) {
      onError(e.message || "The update could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="actions no-print" style={{ margin: "0 0 22px" }}>
        <button className="secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back to requests
        </button>
        {["secretary", "manager"].includes(role) && (
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { data, error } = await supabase.rpc(
                  "cr_archive_request",
                  {
                    p_id: r.id,
                    p_version: r.version,
                    p_archive: !r.archived_at,
                  },
                );
                if (error) throw error;
                onUpdate(data);
                onBack();
              } catch (e) {
                onError(e.message || "Could not update archive.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {r.archived_at ? "Restore request" : "Archive request"}
          </button>
        )}
        {r.archived_at && (
          <p>Archived. Restore this request before making changes.</p>
        )}
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
            <Badge
              status={
                assignedReviewer(r) && r.status === "submitted"
                  ? "awaiting_approval"
                  : r.status
              }
            />
          </div>
          <dl className="details-grid">
            <div>
              <dt>{r.on_behalf ? "Prepared by" : "Requested by"}</dt>
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
              <dt>Request type</dt>
              <dd>
                {r.request_type === "vendor"
                  ? "Direct payment to vendor"
                  : "Reimbursement"}
              </dd>
              <dt>Within budget</dt>
              <dd>
                {r.budget_confirmed
                  ? "Confirmed by requester"
                  : "Not recorded (legacy request)"}
              </dd>
              <dt>Delivery</dt>
              <dd>
                {r.delivery === "mail"
                  ? r.address
                  : r.delivery === "zelle"
                    ? `Zelle: ${r.zelle_contact}`
                    : r.delivery === "debit_card"
                      ? "Vendor debit card payment"
                      : "Pickup at school"}
              </dd>
            </div>
            <div>
              <dt>Reviewed by</dt>
              <dd>
                {r.status === "board_review"
                  ? "The board, by vote"
                  : assignedReviewer(r)
                    ? nameOf(r.approver_email)
                    : "The RCAP Treasurer"}
              </dd>
            </div>
            <div className="full">
              {r.event_name && (
                <>
                  <dt>Event</dt>
                  <dd>{r.event_name}</dd>
                </>
              )}
              <dt>Purpose</dt>
              <dd>{r.purpose}</dd>
            </div>
          </dl>
          <div className="form-section">
            <h2>Expenses & documents</h2>
            {r.items.map((item, i) => (
              <div className="expense" key={i}>
                <div className="detail-head">
                  <strong>{item.vendor || item.description}</strong>
                  <strong>{dollars(item.amount_cents)}</strong>
                </div>
                {item.vendor && <p>{item.description}</p>}
                <p className="muted">Purchased {item.date}</p>
                <p>
                  Document total:{" "}
                  {dollars(item.document_total_cents || item.amount_cents)}.
                  Requested from RCAP: {dollars(item.amount_cents)}.
                </p>
                {item.document_total_cents > item.amount_cents && (
                  <div className="coverage-note">
                    <strong>
                      {dollars(item.document_total_cents - item.amount_cents)}{" "}
                      not requested from RCAP
                    </strong>
                    <p>
                      {item.coverage_note ||
                        "See the expense description for covered items."}
                    </p>
                  </div>
                )}
                <ReceiptThumbs receipts={item.receipts} labels />
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
                    <strong>
                      {HISTORY_LABEL[h.action] || h.action.replaceAll("_", " ")}
                    </strong>
                    <p>
                      {nameOf(h.actor_email)} · {dateLabel(h.created_at)}
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
                ? "Funds released"
                : r.status === "approved"
                  ? "Approved, ready to pay"
                  : r.status === "board_review"
                    ? "Up for a board vote"
                    : r.status === "needs_changes"
                      ? "A correction is needed"
                      : r.status === "declined"
                        ? "Request closed"
                        : assignedReviewer(r)
                          ? "Awaiting assigned approval"
                          : "Awaiting the treasurer"}
            </h2>
            <p className="muted">
              {r.status === "submitted"
                ? assignedReviewer(r)
                  ? `Approval requested from ${nameOf(r.approver_email)}. Review the RCAP amount and receipts, then approve or request changes.`
                  : "The treasurer reviews the receipts, then approves, sends it back, or takes it to the board."
                : r.status === "board_review"
                  ? `Board members vote here. ${votes.need} of ${eligible.length} yes votes approve it.`
                  : r.status === "approved"
                    ? "Approved. The treasurer sends payment and records it here with the date."
                    : r.status === "needs_changes"
                      ? "Read the note, then update and resubmit this request."
                      : "The complete record and its receipts remain available here."}
            </p>
            <ol className="milestones">
              {milestones(r, extra.history, staff).map((m) => (
                <li key={m.key} className={m.done ? "done" : ""}>
                  <span className="dot" aria-hidden="true">
                    {m.done ? <Check size={13} /> : null}
                  </span>
                  <div>
                    <strong>{m.label}</strong>
                    {m.done && (m.who || m.at) && (
                      <p>
                        {[
                          m.who,
                          m.at &&
                            (/^\d{4}-\d{2}-\d{2}$/.test(m.at)
                              ? dayLabel(m.at)
                              : dateLabel(m.at)),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {r.status === "board_review" && (
              <ul className="votes">
                {votes.votes.map((v) => (
                  <li key={v.name}>
                    <span>{v.name}</span>
                    <span className={`vote ${v.vote || "pending"}`}>
                      {v.vote === "yes"
                        ? "Yes"
                        : v.vote === "no"
                          ? "No"
                          : "Not yet"}
                    </span>
                    {v.note && <small>{v.note}</small>}
                  </li>
                ))}
              </ul>
            )}
            {(allowed("approved") || allowed("vote")) && (
              <ApprovalRecipients
                value={approvalRecipients}
                onChange={setApprovalRecipients}
              />
            )}
            {["approved", "needs_changes", "paid", "board_review", "vote"].some(
              allowed,
            ) && (
              <div className="form-section">
                {[
                  "needs_changes",
                  "declined",
                  "vote",
                  "board_review",
                  "approved",
                ].some(allowed) && (
                  <Field label="Note">
                    <textarea
                      maxLength={2000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Explain a decision, a correction, or a no vote. The requester sees notes on corrections and declines."
                    />
                  </Field>
                )}
                {allowed("paid") && (
                  <div className="fields" style={{ marginTop: 20 }}>
                    <Field
                      full
                      label="Zelle confirmation or check number"
                      value={payment}
                      maxLength={100}
                      onChange={(e) => setPayment(e.target.value)}
                    />
                    <Field
                      full
                      label="Date funds were sent"
                      type="date"
                      max={today()}
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                )}
                <div className="actions decision">
                  {allowed("approved") && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => change("approved")}
                    >
                      <Check size={16} /> Approve {dollars(r.total_cents)}
                    </button>
                  )}
                  {allowed("vote") && (
                    <>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => change("vote_approve")}
                      >
                        <Check size={16} /> Vote yes
                      </button>
                      <button
                        className="danger"
                        disabled={busy || note.trim().length < 5}
                        onClick={() => change("vote_decline")}
                      >
                        Vote no
                      </button>
                    </>
                  )}
                  {allowed("board_review") && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => change("board_review")}
                    >
                      Send to the board
                    </button>
                  )}
                  {allowed("needs_changes") && (
                    <button
                      className="secondary"
                      disabled={busy || note.trim().length < 5}
                      onClick={() => change("needs_changes")}
                    >
                      Send back for changes
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
                  {[
                    allowed("needs_changes") && "sending back",
                    allowed("declined") && "declining",
                    allowed("vote") && "a no vote",
                  ].filter(Boolean).length
                    ? `A short note is needed for ${[
                        allowed("needs_changes") && "sending back",
                        allowed("declined") && "declining",
                        allowed("vote") && "a no vote",
                      ]
                        .filter(Boolean)
                        .join(", ")}. `
                    : ""}
                  Every action is recorded with your name and the time.
                </p>
              </div>
            )}
            {allowed("duplicate") && (
              <details className="duplicate-box">
                <summary>This is a duplicate</summary>
                <p className="muted">
                  Closes this request and texts the requester that it duplicates
                  another one. Nothing is paid.
                </p>
                <div className="actions">
                  <Field
                    label="Duplicate of request #"
                    inputMode="numeric"
                    value={dupOf}
                    onChange={(e) =>
                      setDupOf(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    placeholder="e.g. 11"
                  />
                  <button
                    className="secondary"
                    disabled={busy || !dupOf || dupOf === String(r.reference)}
                    onClick={() => change("duplicate")}
                  >
                    Close as duplicate
                  </button>
                </div>
              </details>
            )}
          </section>
          {canReassign && (
            <details className="request-help reassignment no-print">
              <summary>Change approver</summary>
              <form onSubmit={reassign}>
                <p className="muted">
                  Correct the reviewer for this request only. Earlier notices
                  cannot be recalled.
                </p>
                <label>
                  New approver
                  <select
                    value={approverChoice}
                    onChange={(event) => setApproverChoice(event.target.value)}
                  >
                    {!r.on_behalf && !requesterIsTreasurer && (
                      <option value="">Treasurer default</option>
                    )}
                    {reviewerOptions.map((person) => (
                      <option key={person.email} value={person.email}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reason for change
                  <textarea
                    required
                    minLength={5}
                    maxLength={500}
                    value={reassignReason}
                    onChange={(event) => setReassignReason(event.target.value)}
                    placeholder="For example, this committee has a different reviewer"
                  />
                </label>
                <button
                  className="secondary"
                  disabled={
                    busy ||
                    reassignReason.trim().length < 5 ||
                    approverChoice ===
                      (assignedReviewer(r) ? r.approver_email : "")
                  }
                >
                  {busy ? "Saving…" : "Save and notify reviewers"}
                </button>
              </form>
            </details>
          )}
          <section className="record-card" style={{ marginTop: 20 }}>
            <h3>PDF records & receipts</h3>
            <p className="muted">
              Each receipt image stays on one page. Download a dated copy of
              your request and its approval or payment record.
            </p>
            {extra.notifications.filter((n) => n.archive_files?.length)
              .length ? (
              extra.notifications
                .filter((n) => n.archive_files?.length)
                .map((n) => (
                  <div key={n.id}>
                    <p>{dateLabel(n.created_at)}</p>
                    {n.archive_files.map((file) => (
                      <button
                        type="button"
                        className="text-button"
                        key={file.path}
                        onClick={async () => {
                          try {
                            window.location.assign(await archiveUrl(file.path));
                          } catch {
                            onError(
                              "Could not open the PDF. Please try again.",
                            );
                          }
                        }}
                      >
                        {file.name}
                      </button>
                    ))}
                  </div>
                ))
            ) : (
              <p>PDF records will appear here after background processing.</p>
            )}
            <h3>Request updates</h3>
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
                        {n.state === "failed" && (
                          <small style={{ display: "block" }}>
                            {n.last_error ||
                              "Delivery will retry automatically."}
                          </small>
                        )}
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
              <p>No request updates to show yet.</p>
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
    [role, setRole] = useState("board"),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    onError("");
    try {
      if (!phoneIdentity(email))
        throw new Error("Enter a valid cellphone number.");
      await act("staff", { name, email: phoneIdentity(email), role });
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
        Add the cellphone number each board member uses to sign in. Everyone
        here sees the full queue. The treasurer approves and pays; board members
        vote when the treasurer sends a request to the board; admins watch, send
        requests back, and close duplicates.
      </p>
      <ul className="inline-list">
        {Object.entries(
          staff.reduce((groups, person) => {
            (groups[person.name] ||= []).push(person);
            return groups;
          }, {}),
        ).map(([name, entries]) => (
          <li key={name}>
            <details>
              <summary>
                {name} • {name === "Crystal Jones"
                  ? "Co-Chair"
                  : name === "Mose James"
                    ? "Chairman"
                    : [...new Set(entries.map((s) => s.role))].join(", ")}
              </summary>
              {entries.map((s) => (
                <p key={s.email}>
                  {s.email} ({s.email.startsWith("+") ? "Cellphone" : "Email"})
                </p>
              ))}
            </details>
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
            label="Board member cellphone"
            type="tel"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field label="Board role">
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="board">Board member (votes when asked)</option>
              <option value="treasurer">Treasurer (approves and pays)</option>
              <option value="secretary">Admin (watches, sends back)</option>
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
export function App() {
  const [user, setUser] = useState(null),
    [authLoading, setAuthLoading] = useState(true),
    [tab, setTab] = useState(() =>
      location.hash === "#approvals" ? "approvals" : "new",
    ),
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
  useEffect(() => {
    if (user?.phone)
      setDraft((d) =>
        d.phone ? d : { ...d, phone: normalizePhone(user.phone) },
      );
  }, [user?.phone]);
  const role = staff.find((s) => s.email === contactOf(user))?.role;
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
    const change = () => {
      if (location.hash === "#approvals") setTab("approvals");
      setSelected(
        location.hash.match(/^#request\/([0-9a-f-]{36})$/)?.[1] || null,
      );
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  function navigate(next) {
    setTab(next);
    setSelected(null);
    history.replaceState(
      null,
      "",
      location.pathname + (next === "approvals" ? "#approvals" : ""),
    );
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
    setNotice("Request updated.");
    refresh();
  }
  function saved(r) {
    update(r);
    setDraft(newDraft());
    setNotice(
      `Request #${r.reference} submitted. Your receipts and request are saved, and request updates are queued.`,
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
  const boardTab = tab === "board" || tab === "approvals";
  const current = records.find((r) => r.id === selected);
  return (
    <div className="cr">
      <header>
        <a className="brand" href="/">
          <Brand reversed width={160} />
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
            <p className="intro-copy">
              The RCAP payment request resource for parents helping with
              committees, events, and assigned jobs. Submit your expenses and
              receipts in one place, then follow your request through approval
              and payment.
            </p>
          </div>
          <span className="private-label">
            <ShieldCheck size={18} /> Private & secure
          </span>
        </div>
        {tab === "new" && !selected && (
          <div
            className="process-overview"
            aria-label="How payment requests work"
          >
            <p className="eyebrow">HOW IT WORKS</p>
            <div>
              <span>
                <strong>Submit</strong> your own request with receipts
              </span>
              <ArrowRight size={16} />
              <span>
                <strong>Assigned review</strong> and approval
              </span>
              <ArrowRight size={16} />
              <span>
                <strong>Payment</strong> by your selected method
              </span>
            </div>
            <p>
              We’ll send status updates. You can also check progress under My
              requests.
            </p>
          </div>
        )}
        <nav className="tabs" aria-label="Check request sections">
          {[
            ["new", "New request"],
            ["mine", "Past requests"],
            ["board", "Board review"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-current={
                tab === key || (key === "board" && boardTab)
                  ? "page"
                  : undefined
              }
              className={
                tab === key || (key === "board" && boardTab) ? "active" : ""
              }
              onClick={() => navigate(key)}
            >
              {label}
            </button>
          ))}
          {user && (
            <button
              style={{ marginLeft: "auto" }}
              onClick={() => navigate("settings")}
              className={tab === "settings" ? "active" : ""}
            >
              Settings
            </button>
          )}
          {user && (
            <button disabled={busy} onClick={signOut}>
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
        ) : selected && !user ? (
          <div className="workspace">
            <section className="form-card">
              <h2>Sign in to view this request</h2>
              <p className="muted">
                Sign in with your cellphone number. Board members use the number
                listed in Board access; requesters use the number they submitted
                with.
              </p>
              <SignIn onError={setError} />
            </section>
            <Guide />
          </div>
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
                It may belong to another account. Sign in with the cellphone
                number or email that has access to this request. Board members
                use the number or email listed in Board access.
              </p>
              <button className="secondary" onClick={() => navigate("mine")}>
                Back to my requests
              </button>
            </div>
          )
        ) : tab === "settings" && user ? (
          <section className="settings-panel">
            <h2>Settings</h2>
            <p className="muted">
              Manage your account and notifications here. Your daily work stays
              in Board review.
            </p>
            <Account user={user} onError={setError} />
            <details className="request-help">
              <summary>Notification preferences</summary>
              <NotificationPreferences user={user} />
            </details>
            {["treasurer", "secretary", "manager"].includes(role) && (
              <details className="request-help">
                <summary>Approval assignments</summary>
                <ApprovalRouting staff={staff} />
              </details>
            )}
            {["secretary", "manager"].includes(role) && (
              <details className="request-help">
                <summary>Board access</summary>
                <Staff staff={staff} onRefresh={refresh} onError={setError} />
              </details>
            )}
          </section>
        ) : tab === "new" ? (
          <>
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
          </>
        ) : !user ? (
          <div className="workspace">
            <section className="form-card">
              <h2>{boardTab ? "Board review" : "Your requests"}</h2>
              <p className="muted">
                {boardTab
                  ? "Use your cellphone number. Board access is added to that number by the admin."
                  : "Sign in to see your requests, reviewer notes, and payment status."}
              </p>
              <SignIn onError={setError} />
            </section>
            <Guide />
          </div>
        ) : boardTab && !role ? (
          <div className="empty">
            <ShieldCheck size={35} />
            <h2>Board access is needed</h2>
            <p className="muted">
              The admin can add your cellphone number in Board access.
            </p>
            <p>{contactOf(user)}</p>
            <button className="secondary" onClick={() => navigate("mine")}>
              View my requests
            </button>
          </div>
        ) : (
          <>
            <RequestList
              records={
                tab === "mine" && !["manager", "secretary", "treasurer"].includes(role)
                  ? records.filter((r) => r.owner_id === user.id)
                  : records
              }
              key={tab}
              board={boardTab}
              staff={staff}
              user={user}
              onError={setError}
              onUpdate={update}
              onEdit={(r) => {
                setDraft(fromRecord(r));
                navigate("new");
              }}
              approvalsOnly={tab === "approvals"}
              contact={contactOf(user)}
              role={role}
              onSelect={select}
              onNew={() => navigate("new")}
              loading={loading}
              onRefresh={refresh}
            />
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
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
