import React, { useEffect, useState } from "react";
import { COMMITTEES } from "../committee/data.js";
import { act, loadRoutes } from "./api.js";

const committees = [...COMMITTEES.map((c) => c.name), "General RCAP", "Other RCAP expense"];

export default function ApprovalRouting({ staff }) {
  const [routes, setRoutes] = useState([]);
  const [committee, setCommittee] = useState("");
  const [requestType, setRequestType] = useState("reimbursement");
  const [approver, setApprover] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    loadRoutes().then(setRoutes).catch(() => setMessage("Could not load approval assignments."));
  }, []);
  const reviewers = staff.filter((s) => ["board", "treasurer", "manager"].includes(s.role));
  const selected = routes.find((r) => r.committee === committee && r.request_type === requestType);
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await act("route", { committee, request_type: requestType, approver_email: approver });
      setRoutes(await loadRoutes());
      setMessage(approver ? "Approval assignment saved." : "Assignment cleared. New requests will go to the treasurer.");
    } catch (error) {
      setMessage(error.message || "Could not save the assignment.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-card admin-panel">
      <h2>Approval assignments</h2>
      <p className="muted">The requester submits once. The selected board member receives requests for this committee and type. Unassigned requests go to the treasurer. Changes affect new submissions only.</p>
      <form onSubmit={save}>
        <div className="fields">
          <label>Committee
            <select required value={committee} onChange={(e) => { setCommittee(e.target.value); setApprover(routes.find((r) => r.committee === e.target.value && r.request_type === requestType)?.approver_email || ""); }}>
              <option value="">Choose a committee</option>
              {committees.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label>Request type
            <select value={requestType} onChange={(e) => { setRequestType(e.target.value); setApprover(routes.find((r) => r.committee === committee && r.request_type === e.target.value)?.approver_email || ""); }}>
              <option value="reimbursement">Reimbursement</option>
              <option value="vendor">Vendor payment</option>
            </select>
          </label>
          <label>Reviewer
            <select value={approver} onChange={(e) => setApprover(e.target.value)}>
              <option value="">Treasurer default</option>
              {reviewers.map((person) => <option key={person.email} value={person.email}>{person.name} ({person.email.startsWith("+") ? "text" : "email"})</option>)}
            </select>
          </label>
        </div>
        <p className="muted">Current assignment: {selected ? staff.find((s) => s.email === selected.approver_email)?.name || selected.approver_email : "Treasurer default"}.</p>
        <button className="secondary" disabled={busy || !committee}>{busy ? "Saving…" : "Save assignment"}</button>
      </form>
      {message && <p role="status">{message}</p>}
      {routes.length > 0 && <details className="request-help"><summary>View all assignments ({routes.length})</summary><ul className="inline-list">{routes.map((route) => <li key={`${route.committee}:${route.request_type}`}>{route.committee}, {route.request_type}: {staff.find((s) => s.email === route.approver_email)?.name || route.approver_email}</li>)}</ul></details>}
    </section>
  );
}
