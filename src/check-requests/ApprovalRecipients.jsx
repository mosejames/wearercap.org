import React, { useEffect, useState } from "react";
import { loadApprovalContacts } from "./api.js";

const emailPattern = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;
const addresses = (value) => [
  ...new Set(
    (Array.isArray(value) ? value : String(value || "").split(/[,;\n]/))
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  ),
];

export default function ApprovalRecipients({ value, onChange }) {
  const [contacts, setContacts] = useState([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const selected = addresses(value);

  useEffect(() => {
    let live = true;
    loadApprovalContacts()
      .then((items) => {
        if (live) setContacts(items);
      })
      .catch(() => {
        if (live) setError("Saved people could not load. You can still add an email.");
      });
    return () => {
      live = false;
    };
  }, []);

  const known = new Set(contacts.map((contact) => contact.email));
  const choices = [
    ...contacts,
    ...selected
      .filter((address) => !known.has(address))
      .map((address) => ({ name: address, email: address })),
  ];

  function toggle(address) {
    if (contacts.some((contact) => contact.email === address && contact.automatic)) return;
    onChange(
      selected.includes(address)
        ? selected.filter((item) => item !== address)
        : [...selected, address],
    );
  }

  function addEmail() {
    const address = email.trim().toLowerCase();
    if (!emailPattern.test(address) || address.length > 254) {
      setError("Enter a valid email address.");
      return;
    }
    if (selected.length >= 20 && !selected.includes(address)) {
      setError("Choose no more than 20 additional recipients.");
      return;
    }
    if (contacts.some((contact) => contact.email === address && contact.automatic)) {
      setEmail("");
      setError("");
      return;
    }
    if (!selected.includes(address)) onChange([...selected, address]);
    setEmail("");
    setError("");
  }

  return (
    <fieldset className="approval-recipients">
      <legend>Approval confirmation email recipients</legend>
      <p className="muted">
        The requester and configured RCAP contacts are included automatically.
        Check anyone else who should get the approval summary. Receipts stay
        private. Addresses are visible to everyone on that email.
      </p>
      <div className="recipient-choices">
        {choices.map((contact) => {
          const checked = contact.automatic || selected.includes(contact.email);
          return (
            <label
              className={`recipient-choice${checked ? " selected" : ""}${contact.automatic ? " automatic" : ""}`}
              key={contact.email}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!!contact.automatic}
                onChange={() => toggle(contact.email)}
              />
              <span>
                <strong>{contact.name}</strong>
                {contact.name !== contact.email && <small>{contact.email}</small>}
                {contact.automatic && <small>Included automatically</small>}
              </span>
            </label>
          );
        })}
      </div>
      <details className="recipient-extra">
        <summary>Add another email</summary>
        <div className="recipient-add">
          <input
            type="email"
            aria-label="Another recipient email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addEmail();
              }
            }}
          />
          <button type="button" className="secondary" onClick={addEmail}>
            Add
          </button>
        </div>
      </details>
      {error && <p className="recipient-error" role="alert">{error}</p>}
    </fieldset>
  );
}
