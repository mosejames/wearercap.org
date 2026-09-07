export function requesterRecap(snapshot: any) {
  const r = snapshot.request;
  const event = snapshot.event;
  const money = (n: number) => "$" + (Number(n) / 100).toFixed(2);
  const message: Record<string, string> = {
    submitted:
      "Thank you for submitting your reimbursement request. The finance team will review your expenses and receipts and coordinate the required board approval.",
    resubmitted:
      "Thank you for updating your reimbursement request. The finance team will review your revised details and receipts.",
    approved:
      "Your reimbursement request has been approved. Thank you for providing your receipts. Payment has not yet been recorded; the finance team will coordinate the next step.",
    declined:
      "Your reimbursement request was declined. Please review the decision below and contact RCAP if you have questions.",
    needs_changes:
      "The reviewer needs a few changes before your request can move forward. Please review the note below and update your request.",
    paid: "Payment has been recorded for your reimbursement request. Thank you for supporting RCAP.",
  };
  const method: Record<string, string> = {
    mail: "Check by mail",
    pickup: "Check pickup at school",
    zelle: "Zelle",
  };
  return [
    `Hi ${r.requester_name},`,
    "",
    message[event.action] || "Your RCAP reimbursement request has an update.",
    "",
    `Request #${r.reference}`,
    `Total requested: ${money(r.total_cents)}`,
    `Payment method: ${method[r.delivery] || r.delivery}`,
    `Payable to: ${r.payee}`,
    ...(r.delivery === "mail" ? [`Mailing address: ${r.address}`] : []),
    ...(r.delivery === "zelle"
      ? [`Zelle email or cellphone: ${r.zelle_contact}`]
      : []),
    `Committee: ${r.committee}`,
    `What the money was spent for: ${r.purpose}`,
    "",
    "Expenses:",
    ...r.items.map(
      (item: any, i: number) =>
        `${i + 1}. ${item.description} | ${item.date} | ${money(item.amount_cents)} | ${item.receipts.length} receipt(s)`,
    ),
    ...(event.note ? ["", `Review / activity note: ${event.note}`] : []),
    ...(r.payment_reference
      ? [`Payment reference: ${r.payment_reference}`]
      : []),
    ...(r.payment_date ? [`Payment date: ${r.payment_date}`] : []),
    "",
    "Your PDF record and receipts are attached. Larger requests may arrive in numbered parts. You can also download your PDF and follow its status under Past requests:",
    `https://wearercap.org/check-requests/#request/${r.id}`,
    "",
    "If your account uses a cellphone, status updates will also be sent by text.",
    "",
    "Thank you for helping make RCAP events and activities possible.",
    "RCAP Finance Team",
    "Questions? rcaparents@ronclarkacademy.com",
  ].join("\n");
}
