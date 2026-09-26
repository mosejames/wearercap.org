export const STATUS = {
  submitted: "Awaiting treasurer",
  board_review: "Board vote",
  needs_changes: "Changes requested",
  approved: "Approved",
  declined: "Declined",
  paid: "Paid",
};
export const dollars = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function toCents(value) {
  const s = String(value).trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [a, b = ""] = s.split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  return n > 0 && n <= 100000000 ? n : null;
}
export const normalizePhone = (value) =>
  String(value)
    .replace(/\D/g, "")
    .replace(/^1(?=\d{10}$)/, "");
export function validateDraft(d) {
  if (d.requester_name.trim().length < 2 || d.payee.trim().length < 2)
    return "Enter your full name and the check payee.";
  if (!/^\d{10}$/.test(normalizePhone(d.phone)))
    return "Enter a 10-digit phone number.";
  if (!d.committee) return "Choose a committee.";
  if (d.purpose.trim().length < 10)
    return "Describe what these expenses were for in at least 10 characters.";
  if (!["reimbursement", "vendor"].includes(d.request_type))
    return "Choose reimbursement or direct vendor payment.";
  if (
    d.delivery !== "zelle" &&
    !(d.request_type === "vendor" && d.delivery === "debit_card")
  )
    return "Use Zelle for reimbursements, or debit card for vendors without Zelle.";
  if (d.delivery === "zelle" && !validZelle(d.zelle_contact))
    return "Enter the email or cellphone number registered with Zelle.";
  if (!d.items.length || d.items.length > 20)
    return "Include between 1 and 20 expenses.";
  for (let i = 0; i < d.items.length; i++) {
    const item = d.items[i];
    if (
      d.request_type !== "vendor" &&
      (item.vendor || "").trim().length < 2
    )
      return `Enter the store or vendor for expense ${i + 1}.`;
    if (item.description.trim().length < 2) return `Describe expense ${i + 1}.`;
    if (!item.date || item.date > today())
      return `Choose a valid date for expense ${i + 1}.`;
    if (toCents(item.amount) === null)
      return `Enter a positive amount with no more than two decimal places for expense ${i + 1}.`;
    if (
      toCents(item.document_total) === null ||
      toCents(item.amount) > toCents(item.document_total)
    )
      return `Requested amount must not exceed the receipt or invoice total for expense ${i + 1}.`;
    if (!item.receipts?.length)
      return `Attach at least one receipt for expense ${i + 1}.`;
  }
  if (
    d.archive_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.archive_email.trim())
  )
    return "Enter a valid email for your PDF copy.";
  if (!d.budget_confirmed) return "Confirm this expense is within budget.";
  if (!d.acknowledged)
    return "Confirm the reimbursement statement before submitting.";
  return null;
}
export function validateFiles(files) {
  if (files.length > 5) return "Use no more than 5 receipts per expense.";
  if (
    files.some(
      (f) => !["application/pdf", "image/jpeg", "image/png"].includes(f.type),
    )
  )
    return "Use PDF, JPG, or PNG receipts.";
  if (files.some((f) => f.size === 0 || f.size > 10 * 1024 * 1024))
    return "Each receipt must be between 1 byte and 10 MB.";
  return null;
}
// Mirrors cr_private.mutate, which is the real gate. The treasurer reviews
// every request; admins (secretary, manager) watch, send back, and close
// duplicates; board members vote when the treasurer sends one to the board.
const ADMINS = ["secretary", "manager"];
const OPEN = ["submitted", "board_review", "needs_changes"];
export function actionAllowed(r, role, email, action, opts = {}) {
  const own = r.email === email;
  if (action === "edit") return own && r.status === "needs_changes";
  if (action === "duplicate")
    return (
      OPEN.includes(r.status) &&
      (own || ["treasurer", "board", ...ADMINS].includes(role))
    );
  if (own) return false;
  if (action === "paid")
    return (
      r.status === "approved" &&
      (role === "treasurer" ||
        (ADMINS.includes(role) && !!opts.ownerIsTreasurer))
    );
  if (["approved", "declined", "board_review"].includes(action))
    return role === "treasurer" && r.status === "submitted";
  if (action === "needs_changes")
    return (
      ["submitted", "board_review"].includes(r.status) &&
      ["treasurer", ...ADMINS].includes(role)
    );
  if (action === "vote")
    return (
      r.status === "board_review" &&
      ["board", "treasurer"].includes(role) &&
      !!opts.canVote
    );
  return false;
}

// People who may vote on a request: board members and the treasurer, counted
// once per name (one person can have a cellphone and an email login), never
// the requester.
export function voters(staff, r) {
  const requester = staff.find((s) => s.email === r.email)?.name;
  return [
    ...new Set(
      staff
        .filter((s) => ["board", "treasurer"].includes(s.role))
        .map((s) => s.name)
        .filter((n) => n !== requester),
    ),
  ].sort();
}

// Latest vote per voter since the request last went up for a vote.
export function tally(history, staff, r) {
  const eligible = voters(staff, r);
  const nameOf = (email) => staff.find((s) => s.email === email)?.name;
  let since = 0;
  for (const h of history)
    if (["board_review", "submitted", "resubmitted"].includes(h.action))
      since = Math.max(since, Date.parse(h.created_at));
  const latest = {};
  for (const h of history) {
    if (!["vote_approve", "vote_decline"].includes(h.action)) continue;
    if (Date.parse(h.created_at) < since) continue;
    const name = nameOf(h.actor_email);
    if (name && eligible.includes(name)) latest[name] = h;
  }
  const votes = eligible.map((name) => ({
    name,
    vote: latest[name]?.action === "vote_approve"
      ? "yes"
      : latest[name]?.action === "vote_decline"
        ? "no"
        : null,
    note: latest[name]?.note || "",
  }));
  return {
    votes,
    yes: votes.filter((v) => v.vote === "yes").length,
    no: votes.filter((v) => v.vote === "no").length,
    need: Math.floor(eligible.length / 2) + 1,
  };
}

// The approval trail a treasurer reads top to bottom: submitted, decided,
// paid. Built from history so it matches the permanent record.
export function milestones(r, history, staff) {
  const nameOf = (email) =>
    staff.find((s) => s.email === email)?.name || email;
  const last = (actions) =>
    [...history].reverse().find((h) => actions.includes(h.action));
  const sent = last(["submitted", "resubmitted"]);
  const board = last(["board_review"]);
  const decided = last(["approved", "declined", "duplicate"]);
  const decidedByVote = decided?.note?.startsWith("Board vote:");
  const steps = [
    {
      key: "submitted",
      label: "Submitted",
      done: !!sent,
      who: r.requester_name,
      at: sent?.created_at,
    },
  ];
  if (board || r.status === "board_review")
    steps.push({
      key: "board",
      label: "Sent to board vote",
      done: !!board || r.status === "board_review",
      who: board ? nameOf(board.actor_email) : "",
      at: board?.created_at,
    });
  steps.push({
    key: "decision",
    label:
      !decided && r.status === "board_review"
        ? "Board decision"
        : decided?.action === "declined"
        ? "Declined"
        : decided?.action === "duplicate"
          ? "Closed as duplicate"
          : decidedByVote
            ? "Approved by board vote"
            : "Approved by treasurer",
    done: ["approved", "declined", "paid"].includes(r.status) && !!decided,
    who: decided
      ? decidedByVote
        ? decided.note
        : nameOf(decided.actor_email)
      : "",
    at: decided?.created_at,
  });
  if (decided?.action !== "declined" && decided?.action !== "duplicate")
    steps.push({
      key: "paid",
      label: "Funds released",
      done: r.status === "paid",
      who: r.status === "paid" ? `Reference ${r.payment_reference}` : "",
      at: r.status === "paid" ? r.payment_date : null,
    });
  return steps;
}
export const newItem = () => ({
  key: crypto.randomUUID(),
  date: "",
  vendor: "",
  description: "",
  amount: "",
  document_total: "",
  receipts: [],
});
export const newDraft = () => ({
  id: crypto.randomUUID(),
  requester_name: "",
  phone: "",
  payee: "",
  delivery: "zelle",
  request_type: "reimbursement",
  budget_confirmed: false,
  address: "",
  zelle_contact: "",
  committee: "",
  purpose: "",
  approver_email: "",
  items: [newItem()],
  archive_email: "",
  acknowledged: false,
});
export function fromRecord(r) {
  return {
    ...r,
    delivery: r.delivery === "debit_card" ? "debit_card" : "zelle",
    budget_confirmed: false,
    acknowledged: false,
    approver_email: r.approver_email || "",
    items: r.items.map((i) => ({
      ...i,
      key: crypto.randomUUID(),
      vendor: i.vendor || "",
      amount: (i.amount_cents / 100).toFixed(2),
      document_total: (
        (i.document_total_cents || i.amount_cents) / 100
      ).toFixed(2),
    })),
  };
}

export function phoneIdentity(value) {
  const digits = normalizePhone(value);
  return /^\d{10}$/.test(digits) ? `+1${digits}` : null;
}
export function contactOf(user) {
  return user?.phone
    ? `+${user.phone.replace(/^\+/, "")}`
    : user?.email?.toLowerCase() || "";
}

export function validZelle(value) {
  const s = String(value || "").trim();
  return (
    s.length <= 254 &&
    (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || Boolean(phoneIdentity(s)))
  );
}
