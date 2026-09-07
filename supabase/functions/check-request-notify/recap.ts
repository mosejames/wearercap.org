export function requesterRecap(snapshot: any, attached = true) {
  const r = snapshot.request;
  const event = snapshot.event;
  const vendor = r.request_type === "vendor";
  const money = (n: number) => "$" + (Number(n) / 100).toFixed(2);
  const message: Record<string, string> = {
    submitted:
      "Thank you for submitting your payment request. The finance team will review your expenses and supporting documents and coordinate the required board approval.",
    resubmitted:
      "Thank you for updating your payment request. The finance team will review your revised details and supporting documents.",
    assigned:
      "Your request has been assigned to a board member for review. No approval decision has been made yet.",
    approved:
      "Your payment request has been approved. Thank you for providing your supporting documents. Payment has not yet been recorded; the finance team will coordinate the next step.",
    declined:
      "Your payment request was declined. Please review the decision below and contact RCAP if you have questions.",
    needs_changes:
      "The reviewer needs a few changes before your request can move forward. Please review the note below and update your request.",
    paid: "Payment has been recorded for your payment request. Thank you for supporting RCAP.",
  };
  const method: Record<string, string> = {
    mail: "Check by mail",
    pickup: "Check pickup at school",
    zelle: "Zelle",
    debit_card: "Vendor debit card payment (Zelle unavailable)",
  };
  return [
    `Hi ${r.requester_name},`,
    "",
    message[event.action] || "Your RCAP payment request has an update.",
    "",
    `Request #${r.reference}`,
    `Request type: ${vendor ? "Direct payment to vendor" : "Reimbursement"}`,
    `Within budget: ${r.budget_confirmed ? "Confirmed by requester" : "Not recorded on this version"}`,
    `Total requested: ${money(r.total_cents)}`,
    `Payment method: ${method[r.delivery] || r.delivery}`,
    `Payable to: ${r.payee}`,
    ...(r.delivery === "mail" ? [`Mailing address: ${r.address}`] : []),
    ...(r.delivery === "zelle"
      ? [`Zelle email or cellphone: ${r.zelle_contact}`]
      : []),
    `Committee: ${r.committee}`,
    `Purpose of payment: ${r.purpose}`,
    "",
    "Expenses:",
    ...r.items.map(
      (item: any, i: number) =>
        `${i + 1}. ${item.description} | ${item.date} | ${money(item.amount_cents)} | ${item.receipts.length} document(s)${item.document_total_cents ? ` | Document total: ${money(item.document_total_cents)}` : ""}`,
    ),
    ...(event.note ? ["", `Review / activity note: ${event.note}`] : []),
    ...(r.payment_reference
      ? [`Payment reference: ${r.payment_reference}`]
      : []),
    ...(r.payment_date ? [`Payment date: ${r.payment_date}`] : []),
    "",
    attached
      ? "Your PDF record and supporting documents are attached. Larger requests may arrive in numbered parts. You can also download your PDF and follow its status under Past requests:"
      : "You can download your PDF record and follow its status under Past requests:",
    `https://wearercap.org/check-requests/#request/${r.id}`,
    "",
    "Status updates follow the notification preference in your dashboard.",
    "",
    "Thank you for helping make RCAP events and activities possible.",
    "RCAP Finance Team",
    "Questions? rcaparents@ronclarkacademy.com",
  ].join("\n");
}
