export const STATUS = {
  submitted: "Awaiting approval",
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
export function actionAllowed(r, role, email, action) {
  const own = r.email === email;
  if (action === "edit") return own && r.status === "needs_changes";
  if (action === "assign")
    return (
      ["secretary", "manager"].includes(role) &&
      ["submitted", "needs_changes"].includes(r.status)
    );
  if (own) return false;
  if (action === "paid") return role === "treasurer" && r.status === "approved";
  if (r.status !== "submitted") return false;
  if (action === "needs_changes")
    return (
      r.approver_email === email || ["secretary", "manager"].includes(role)
    );
  return (
    ["approved", "declined"].includes(action) && r.approver_email === email
  );
}
export const newItem = () => ({
  key: crypto.randomUUID(),
  date: "",
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
