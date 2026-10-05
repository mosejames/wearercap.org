import React, { useEffect, useState } from "react";
import { COMMITTEES } from "../committee/data.js";
import { loadRoutes, saveCommitteeAssignment } from "./api.js";

const committees = [...COMMITTEES.map((item) => item.name), "General RCAP", "Other RCAP expense"];

export function boardReviewers(staff) {
  const people = staff
    .filter((person) => ["board", "secretary", "manager"].includes(person.role) && person.name !== "RCA Parents")
    .sort((a, b) => Number(a.email.startsWith("+")) - Number(b.email.startsWith("+")));
  return [...new Map(people.map((person) => [person.name, person])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));
}

function routeDraft(routes, committee) {
  const route = routes.find((item) => item.committee === committee);
  return {
    active: !!route,
    approver: route?.approver_email || "",
    backup: route?.backup_email || "",
  };
}

export default function ApprovalRouting({ staff }) {
  const [routes, setRoutes] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const reviewers = boardReviewers(staff);

  useEffect(() => {
    let live = true;
    loadRoutes()
      .then((items) => {
        if (!live) return;
        setRoutes(items);
        setDrafts(Object.fromEntries(committees.map((committee) => [committee, routeDraft(items, committee)])));
      })
      .catch(() => {
        if (live) setMessage("Could not load committee assignments.");
      });
    return () => { live = false; };
  }, []);

  function set(committee, patch) {
    setDrafts((current) => ({
      ...current,
      [committee]: { ...current[committee], ...patch },
    }));
    setMessage("");
  }

  async function save(event, committee) {
    event.preventDefault();
    const draft = drafts[committee];
    if (draft.active && (!draft.approver || draft.approver === draft.backup)) {
      setMessage("Choose a primary reviewer and a different backup for " + committee + ".");
      return;
    }
    setBusy(committee);
    setMessage("");
    try {
      await saveCommitteeAssignment(committee, draft);
      const fresh = await loadRoutes();
      setRoutes(fresh);
      setDrafts((current) => ({ ...current, [committee]: routeDraft(fresh, committee) }));
      setMessage(committee + " assignment " + (draft.active ? "saved" : "turned off") + ". New requests use this setting.");
    } catch (error) {
      setMessage(error.message || "Could not save the assignment.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="form-card admin-panel">
      <h2>Committee reviewers</h2>
      <p className="muted">
        Choose who approves requests for each committee. This applies to reimbursements and vendor payments.
        The treasurer records payment after approval. A backup can be assigned to a specific request when the primary is unavailable.
      </p>
      <div className="committee-assignments">
        {committees.map((committee) => {
          const draft = drafts[committee] || { active: false, approver: "", backup: "" };
          const route = routes.find((item) => item.committee === committee);
          return (
            <form className="committee-assignment" key={committee} onSubmit={(event) => save(event, committee)}>
              <div className="committee-assignment-name">
                <strong>{committee}</strong>
                <span className="muted">{route ? "On" : "Off"}</span>
              </div>
              <label>
                Primary reviewer
                <select
                  aria-label={committee + " primary reviewer"}
                  value={draft.approver}
                  disabled={!draft.active || !!busy}
                  onChange={(event) => set(committee, { approver: event.target.value })}
                >
                  <option value="">Choose a board person</option>
                  {reviewers.map((person) => <option value={person.email} key={person.email}>{person.name}</option>)}
                </select>
              </label>
              <label>
                Backup (optional)
                <select
                  aria-label={committee + " backup reviewer"}
                  value={draft.backup}
                  disabled={!draft.active || !!busy}
                  onChange={(event) => set(committee, { backup: event.target.value })}
                >
                  <option value="">No backup</option>
                  {reviewers.map((person) => <option value={person.email} key={person.email}>{person.name}</option>)}
                </select>
              </label>
              <label className="assignment-toggle">
                <input
                  type="checkbox"
                  aria-label={committee + " assignment on"}
                  checked={draft.active}
                  disabled={!!busy}
                  onChange={(event) => set(committee, { active: event.target.checked })}
                />
                On
              </label>
              <button className="secondary" disabled={!!busy || (draft.active && !draft.approver)}>
                {busy === committee ? "Saving…" : "Save"}
              </button>
            </form>
          );
        })}
      </div>
      <p className="muted">An off or unassigned committee waits for finance staff to assign a reviewer. Existing requests keep their current reviewer.</p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
