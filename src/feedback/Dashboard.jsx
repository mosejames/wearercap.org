import React, { useEffect, useState } from "react";
import { call } from "./api.js";
import {
  newSurvey,
  newQuestion,
  surveyError,
  chatPrompt,
  importDraft,
} from "./builder.js";
import { SurveyFlow } from "./App.jsx";
import Results from "./Results.jsx";
export default function Dashboard() {
  const [auth, setAuth] = useState(() => ({
      token: new URLSearchParams(location.hash.slice(1)).get("invite") || "",
      pass: "",
    })),
    [data, setData] = useState(null),
    [edit, setEdit] = useState(null),
    [results, setResults] = useState(null),
    [preview, setPreview] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [inviteLabel, setInviteLabel] = useState(""),
    [inviteLink, setInviteLink] = useState(""),
    [brief, setBrief] = useState(""),
    [count, setCount] = useState(6),
    [aiBusy, setAiBusy] = useState(false),
    [importText, setImportText] = useState("");
  const api = (action, payload = {}) => call(action, { ...payload, ...auth });
  async function load() {
    setData(await api("dashboard"));
  }
  useEffect(() => {
    history.replaceState(null, "", location.pathname);
    if (auth.token) run(load);
  }, []);
  useEffect(() => {
    if (!edit) return;
    const prevent = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [edit]);
  async function run(fn) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await fn(api);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function change(patch) {
    setEdit({ ...edit, ...patch });
    setReviewed(false);
  }
  function question(index, patch) {
    change({
      questions: edit.questions.map((q, i) =>
        i === index ? { ...q, ...patch } : q,
      ),
    });
  }
  async function save(status) {
    const problem = surveyError(edit);
    if (problem) throw new Error(problem);
    if (status === "published" && !reviewed)
      throw new Error("Preview your survey before publishing.");
    await api("save", { survey: { ...edit, status } });
    setMessage(
      status === "published"
        ? "Your survey is live. Copy its link below."
        : "Draft saved.",
    );
    setEdit(null);
    setPreview(false);
    await load();
  }
  async function draft() {
    setAiBusy(true);
    setError("");
    try {
      const response = await fetch("/api/feedback-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, brief, count, current: edit }),
      });
      const out = await response.json();
      if (!response.ok) throw new Error(out.error);
      change({
        ...out.survey,
        id: edit.id,
        status: "draft",
        voices_enabled: edit.voices_enabled,
        gallery_url: edit.gallery_url,
      });
      setMessage("Suggested questions are ready. Edit anything, then preview.");
    } catch (e) {
      setError(e.message);
    } finally {
      setAiBusy(false);
    }
  }
  if (!data)
    return (
      <section className="card">
        <p className="eyebrow">RCAP Feedback Studio</p>
        <h1>
          Good questions.
          <br />
          Better experiences.
        </h1>
        <p>
          Invited organizers can create and publish surveys. Open your personal
          invitation link, or use leadership access below.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(load);
          }}
        >
          <label>
            Leadership passcode
            <input
              type="password"
              autoComplete="off"
              value={auth.pass}
              onChange={(e) => setAuth({ token: "", pass: e.target.value })}
            />
          </label>
          <button className="primary" disabled={busy}>
            Open dashboard
          </button>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  return (
    <section className="card dashboard">
      <div className="dash-head">
        <div>
          <p className="eyebrow">RCAP Feedback Studio</p>
          <h1>
            {edit
              ? "Shape your survey."
              : results
                ? "Listen. Learn. Build."
                : "Make room for every voice."}
          </h1>
        </div>
        <button
          onClick={() => {
            setData(null);
            setAuth({ pass: "", token: "" });
            setEdit(null);
            setResults(null);
          }}
        >
          Sign out
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {edit ? (
        <>
          <button
            onClick={() => {
              if (confirm("Leave the editor? Unsaved changes will be lost.")) {
                setEdit(null);
                setPreview(false);
              }
            }}
          >
            ← Dashboard
          </button>
          {preview ? (
            <>
              <div className="preview-banner">
                Preview only. Answers will not be saved.
              </div>
              <SurveyFlow key={edit.id} survey={edit} preview />
              <button onClick={() => setPreview(false)}>Back to editing</button>
            </>
          ) : (
            <>
              <section className="assistant-panel">
                <p className="eyebrow">Question partner · Powered by OpenAI</p>
                <h2>Tell us about your event.</h2>
                <p>
                  What happened? What do you want to learn? Add a follow-up
                  request to refine the current questions. Only this brief and
                  your draft are sent to the AI, never parent responses.
                </p>
                <label>
                  Event brief or follow-up
                  <textarea
                    rows={4}
                    maxLength={4000}
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="We hosted a parent game night. I want to know whether new parents felt included…"
                  />
                </label>
                <label>
                  Number of questions
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                  />
                </label>
                <button disabled={aiBusy || !brief.trim()} onClick={draft}>
                  {aiBusy
                    ? "Shaping questions…"
                    : "Help me shape the questions"}
                </button>
                <small>
                  You can also build and edit every question yourself below.
                </small>
                <details>
                  <summary>Use ChatGPT with copy &amp; import</summary>
                  <p>
                    Copy your brief and draft, paste into ChatGPT, then bring
                    its JSON draft back here. No parent responses are included.
                  </p>
                  <button
                    onClick={() =>
                      run(async () => {
                        await navigator.clipboard.writeText(
                          chatPrompt(edit, brief, count),
                        );
                        setMessage("Prompt copied. Paste it into ChatGPT.");
                      })
                    }
                  >
                    Copy a prompt for ChatGPT
                  </button>
                  <a
                    className="text-link"
                    href="https://chatgpt.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open ChatGPT ↗
                  </a>
                  <label>
                    Paste the draft from ChatGPT
                    <textarea
                      rows={5}
                      maxLength={30000}
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={!importText.trim()}
                    onClick={() =>
                      run(async () => {
                        change({ ...importDraft(importText) });
                        setImportText("");
                        setMessage(
                          "Draft imported. Review and edit before publishing.",
                        );
                      })
                    }
                  >
                    Import draft for review
                  </button>
                </details>
              </section>
              <div className="editor-grid">
                <label>
                  Event name
                  <input
                    maxLength={120}
                    value={edit.event_name}
                    onChange={(e) => change({ event_name: e.target.value })}
                  />
                </label>
                <label>
                  Event date
                  <input
                    type="date"
                    value={edit.event_date}
                    onChange={(e) => change({ event_date: e.target.value })}
                  />
                </label>
                <label>
                  Survey link<span className="muted"> /feedback/</span>
                  <input
                    maxLength={80}
                    value={edit.slug}
                    onChange={(e) => change({ slug: e.target.value })}
                  />
                </label>
                <label>
                  Warm welcome title
                  <input
                    maxLength={160}
                    value={edit.title}
                    onChange={(e) => change({ title: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Introduction
                <textarea
                  maxLength={800}
                  value={edit.intro}
                  onChange={(e) => change({ intro: e.target.value })}
                />
              </label>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={edit.voices_enabled}
                  onChange={(e) => change({ voices_enabled: e.target.checked })}
                />
                <span>Offer optional Voices of RCAP after submission</span>
              </label>
              <p className="privacy">
                Every survey stays anonymous. Do not request names or contact
                details. Keep dues and fundraising separate.
              </p>
              {edit.questions.map((q, i) => (
                <fieldset className="question-editor" key={q.id}>
                  <legend>Question {i + 1}</legend>
                  <label>
                    Question
                    <input
                      maxLength={240}
                      value={q.title}
                      onChange={(e) => question(i, { title: e.target.value })}
                    />
                  </label>
                  <label>
                    Helpful context
                    <input
                      maxLength={400}
                      value={q.help || ""}
                      onChange={(e) => question(i, { help: e.target.value })}
                    />
                  </label>
                  <label>
                    Answer style
                    <select
                      value={q.type}
                      onChange={(e) =>
                        question(i, {
                          options: undefined,
                          items: undefined,
                          max: undefined,
                          ...newQuestion(e.target.value, i + 1),
                          id: q.id,
                          title: q.title,
                          help: q.help,
                        })
                      }
                    >
                      <option value="rating">1 to 5 rating bubbles</option>
                      <option value="matrix">Compact ratings</option>
                      <option value="choice">Choose one</option>
                      <option value="multi">Choose a few</option>
                      <option value="text">Written response</option>
                    </select>
                  </label>
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) =>
                        question(i, { required: e.target.checked })
                      }
                    />
                    Required
                  </label>
                  {(q.options || q.items) && (
                    <label>
                      {q.type === "matrix" ? "Rating items" : "Choices"} (one
                      per line)
                      <textarea
                        value={(q.options || q.items)
                          .map((o) => o.label)
                          .join("\n")}
                        onChange={(e) => {
                          const key = q.type === "matrix" ? "items" : "options";
                          question(i, {
                            [key]: e.target.value
                              .split("\n")
                              .map((label, n) => ({
                                id:
                                  label.trim().toLowerCase() === "other"
                                    ? "other"
                                    : `item${n + 1}`,
                                label,
                              })),
                          });
                        }}
                      />
                    </label>
                  )}
                  {q.type === "multi" && (
                    <label>
                      Maximum choices
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={q.max}
                        onChange={(e) =>
                          question(i, { max: Number(e.target.value) })
                        }
                      />
                    </label>
                  )}
                  <div className="editor-actions">
                    <button
                      disabled={i === 0}
                      onClick={() => {
                        const qs = [...edit.questions];
                        [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]];
                        change({ questions: qs });
                      }}
                    >
                      Move up
                    </button>
                    <button
                      disabled={edit.questions.length === 1}
                      onClick={() =>
                        change({
                          questions: edit.questions.filter((_, n) => n !== i),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </fieldset>
              ))}
              <button
                disabled={edit.questions.length >= 12}
                onClick={() =>
                  change({
                    questions: [
                      ...edit.questions,
                      newQuestion("rating", edit.questions.length + 1),
                    ],
                  })
                }
              >
                + Add question ({edit.questions.length}/12)
              </button>
            </>
          )}
          <div className="editor-actions">
            <button disabled={busy} onClick={() => run(() => save("draft"))}>
              Save draft
            </button>
            <button
              onClick={() => {
                const problem = surveyError(edit);
                if (problem) {
                  setError(problem);
                  return;
                }
                setPreview(true);
                setReviewed(true);
              }}
            >
              Preview survey
            </button>
            <button
              className="primary"
              disabled={busy || !reviewed}
              onClick={() => run(() => save("published"))}
            >
              Publish survey
            </button>
          </div>
        </>
      ) : results ? (
        <>
          <button onClick={() => setResults(null)}>← All surveys</button>
          <Results
            data={results}
            auth={auth}
            run={(fn) =>
              run(async (a) => {
                await fn(a);
                setResults(await api("results", { survey: results.survey.id }));
              })
            }
          />
        </>
      ) : (
        <>
          <button
            className="primary"
            onClick={() => {
              setEdit(newSurvey());
              setReviewed(false);
            }}
          >
            + Create a survey
          </button>
          <div className="survey-list">
            {data.surveys.map((s) => (
              <article key={s.id}>
                <p className="eyebrow">
                  {s.status} · {s.event_date}
                </p>
                <h2>{s.event_name}</h2>
                <p>
                  {s.response_count} responses · {s.questions.length} questions
                  · Voices {s.voices_enabled ? "on" : "off"}
                </p>
                {s.status === "published" && (
                  <a
                    href={`/feedback/${s.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open live survey ↗
                  </a>
                )}
                <div className="editor-actions">
                  <button
                    onClick={() =>
                      run(async () =>
                        setResults(await api("results", { survey: s.id })),
                      )
                    }
                  >
                    View results
                  </button>
                  {s.status === "draft" && (
                    <button
                      onClick={() => {
                        setEdit(s);
                        setReviewed(false);
                      }}
                    >
                      Edit draft
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEdit({
                        ...s,
                        id: crypto.randomUUID(),
                        slug: `${s.slug}-copy`,
                        status: "draft",
                      });
                      setReviewed(false);
                    }}
                  >
                    Duplicate
                  </button>
                  {s.status !== "draft" && (
                    <button
                      onClick={() =>
                        run(async () => {
                          await api("status", {
                            survey: s.id,
                            status:
                              s.status === "published" ? "closed" : "published",
                          });
                          await load();
                        })
                      }
                    >
                      {s.status === "published"
                        ? "Close survey"
                        : "Reopen survey"}
                    </button>
                  )}
                  {s.status === "published" && (
                    <button
                      onClick={() =>
                        run(async () => {
                          await navigator.clipboard.writeText(
                            `${location.origin}/feedback/${s.slug}`,
                          );
                          setMessage("Survey link copied.");
                        })
                      }
                    >
                      Copy link
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {data.leadership && (
            <section className="invite-panel">
              <h2>Invite an organizer</h2>
              <p>
                Each invitation grants access to that organizer’s own surveys.
                Keep the link private. It expires after 90 days and can be
                revoked here.
              </p>
              <label>
                Invitation label
                <input
                  maxLength={80}
                  value={inviteLabel}
                  onChange={(e) => setInviteLabel(e.target.value)}
                  placeholder="Fall event team"
                />
              </label>
              <button
                disabled={!inviteLabel.trim() || busy}
                onClick={() =>
                  run(async () => {
                    const result = await api("invite", { label: inviteLabel });
                    setInviteLink(
                      `${location.origin}/feedback/admin#invite=${result.token}`,
                    );
                    await load();
                  })
                }
              >
                Create invitation link
              </button>
              {inviteLink && (
                <label>
                  Copy this private invitation link
                  <input
                    readOnly
                    value={inviteLink}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
              )}
              {data.invites.map((i) => (
                <div className="invite-row" key={i.id}>
                  <span>
                    {i.label} ·{" "}
                    {i.revoked
                      ? "Revoked"
                      : `Expires ${i.expires_at.slice(0, 10)}`}
                  </span>
                  {!i.revoked && (
                    <button
                      onClick={() =>
                        run(async () => {
                          await api("revoke", { id: i.id });
                          await load();
                        })
                      }
                    >
                      Revoke access
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}
