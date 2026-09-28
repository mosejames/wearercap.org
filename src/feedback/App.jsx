import GalleryInvite from "./GalleryInvite.jsx";
import React, { useEffect, useRef, useState } from "react";
import { Hand, MoveHorizontal, Image as ImageIcon } from "lucide-react";
import Brand from "../components/Brand.jsx";
import { call } from "./api.js";
import { ratingLabels, validateQuestion } from "./model.js";
import Voice from "./Voice.jsx";
const Dashboard = React.lazy(() => import("./Dashboard.jsx"));
export function Rating({ value, onChange, label, hint = false }) {
  const selected = Number.isInteger(value);
  const position = selected ? value : 4;
  return (
    <div
      className={`rating drag-rating ${hint && value == null ? "show-drag-hint" : ""} ${value === "na" ? "not-rated" : ""}`}
    >
      <div className="slider-control">
        <div className="slider-rail" aria-hidden="true">
          <div
            className="slider-fill"
            style={{ width: `${(position - 1) * 25}%` }}
          />
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              className="slider-tick"
              key={n}
              style={{ left: `${(n - 1) * 25}%` }}
            />
          ))}
          <span
            className="slider-dot"
            style={{ left: `${(position - 1) * 25}%` }}
          >
            {position}
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={position}
          aria-label={label}
          aria-valuetext={`${position}: ${ratingLabels[position - 1]}${selected ? "" : ", touch to choose"}`}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={(e) => onChange(Number(e.currentTarget.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onChange(position);
            }
          }}
        />
      </div>
      <div className="slider-numbers" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="range-labels">
        <span>Not for me</span>
        <span>Loved it</span>
      </div>
      {hint && (
        <div className="drag-instruction">
          <Hand size={23} strokeWidth={1.8} aria-hidden="true" />
          <span>Touch and drag{!selected ? " to choose" : ""}</span>
          <MoveHorizontal size={20} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
export function Question({ q, value, onChange }) {
  if (q.type === "rating")
    return (
      <>
        <Rating value={value} onChange={onChange} label={q.title} hint />
        <p className="rating-caption" aria-live="polite">
          {value
            ? ratingLabels[value - 1]
            : "Starts at 4. Your touch makes it your answer."}
        </p>
      </>
    );
  if (q.type === "matrix")
    return (
      <div className="matrix">
        {q.items.map((i, index) => (
          <fieldset key={i.id}>
            <legend>{i.label}</legend>
            <Rating
              label={i.label}
              hint={index === 0}
              value={value?.[i.id]}
              onChange={(v) => onChange({ ...value, [i.id]: v })}
            />
            <button
              className="na"
              aria-pressed={value?.[i.id] === "na"}
              onClick={() => onChange({ ...value, [i.id]: "na" })}
            >
              Didn’t try / Not applicable
            </button>
          </fieldset>
        ))}
      </div>
    );
  if (q.type === "choice")
    return (
      <div className="choices">
        {q.options.map((o) => (
          <button
            className={value === o.id ? "selected" : ""}
            key={o.id}
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
          >
            <span>{o.label}</span>
            <span aria-hidden="true">{value === o.id ? "✓" : "○"}</span>
          </button>
        ))}
      </div>
    );
  if (q.type === "multi") {
    const selected = value?.choices || [];
    return (
      <>
        <div className="choices">
          {q.options.map((o) => (
            <button
              key={o.id}
              className={selected.includes(o.id) ? "selected" : ""}
              aria-pressed={selected.includes(o.id)}
              disabled={!selected.includes(o.id) && selected.length >= q.max}
              onClick={() =>
                onChange({
                  ...value,
                  other:
                    o.id === "other" && selected.includes("other")
                      ? ""
                      : value?.other || "",
                  choices: selected.includes(o.id)
                    ? selected.filter((v) => v !== o.id)
                    : [...selected, o.id],
                })
              }
            >
              <span>{o.label}</span>
              <span aria-hidden="true">
                {selected.includes(o.id) ? "✓" : "+"}
              </span>
            </button>
          ))}
        </div>
        <p className="muted">
          {selected.length} of {q.max} selected
        </p>
        {selected.includes("other") && (
          <label>
            What would you enjoy?
            <input
              maxLength={160}
              value={value.other || ""}
              onChange={(e) => onChange({ ...value, other: e.target.value })}
            />
          </label>
        )}
      </>
    );
  }
  return (
    <label className="text-answer">
      <span>Please leave out names and contact information.</span>
      <textarea
        rows={5}
        maxLength={2000}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="We’re listening."
      />
      <small>{(value || "").length} / 2,000</small>
    </label>
  );
}
export function SurveyFlow({ survey, preview = false }) {
  const [step, setStep] = useState(-1),
    [answers, setAnswers] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [voice, setVoice] = useState(false),
    [duplicate, setDuplicate] = useState(() => {
      try {
        return (
          !preview &&
          localStorage.getItem(`rcap-feedback:${survey.id}`) === "submitted"
        );
      } catch {
        return false;
      }
    });
  const id = useRef(crypto.randomUUID()),
    heading = useRef();
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step, done, voice]);
  const q = survey.questions[step];
  async function next() {
    if (!validateQuestion(q, answers[q.id])) {
      setError("Please answer this question before continuing.");
      return;
    }
    if (!validateQuestion(q, answers[q.id]) && q.type === "text") {
      setError("Please keep your response within 2,000 characters.");
      return;
    }
    setError("");
    if (step < survey.questions.length - 1) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      if (!preview) {
        await call("submit", { survey: survey.id, id: id.current, answers });
        try {
          localStorage.setItem(`rcap-feedback:${survey.id}`, "submitted");
        } catch {}
      }
      setDone(true);
    } catch {
      setError(
        "We couldn’t save your answers. Please try again. Your answers are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return voice && !preview ? (
      <Voice survey={survey} />
    ) : (
      <section className="card thank-you">
        <div className="seal">✓</div>
        <p className="eyebrow">
          {preview ? "Preview complete" : "Feedback received"}
        </p>
        <h1 ref={heading} tabIndex={-1}>
          Better, together.
        </h1>
        <p>
          Thank you for being honest. What you loved and what could be better
          both help us build a stronger RCA school community.
        </p>
        {survey.voices_enabled && (
          <div className="voice-invite">
            <p className="eyebrow">Voices of RCAP</p>
            <h2>Got 30 more seconds?</h2>
            <p>
              Leave an optional voice note for leadership or choose to share it
              with the school community.
            </p>
            <button
              className="primary"
              disabled={preview}
              onClick={() => setVoice(true)}
            >
              Leave a voice note ↗
            </button>
            {preview && (
              <small>Recording is available after a live submission.</small>
            )}
          </div>
        )}
        <GalleryInvite survey={survey} />
      </section>
    );
  if (duplicate)
    return (
      <section className="card">
        <h1>Thanks for weighing in.</h1>
        <p>
          This browser has already sent feedback for this event. If someone else
          is using this device, they can share their own experience.
        </p>
        <button className="primary" onClick={() => setDuplicate(false)}>
          I’m another parent
        </button>
        <a className="text-link" href={survey.gallery_url}>
          Back to the RCAP Capsule ↗
        </a>
      </section>
    );
  if (step === -1)
    return (
      <section className="card intro">
        {(survey.cover_url || survey.slug.startsWith("rb-karaoke")) && (
          <div className={`event-cover ${survey.cover_url ? "has-photo" : ""}`}>
            {survey.cover_url ? (
              <img
                src={survey.cover_url}
                alt="Parents sharing a moment at R&B Karaoke Night"
              />
            ) : (
              <div className="cover-placeholder">
                <ImageIcon size={26} strokeWidth={1.5} aria-hidden="true" />
                <span>R&B KARAOKE NIGHT</span>
                <strong>
                  Good music.
                  <br />
                  Great company.
                </strong>
                <small>One night. Our community.</small>
              </div>
            )}
          </div>
        )}

        <p className="eyebrow">
          RCAP Feedback ·{" "}
          {new Date(survey.event_date + "T12:00:00").toLocaleDateString(
            "en-US",
            { month: "long", day: "numeric", year: "numeric" },
          )}
        </p>
        <div className="event-tag">{survey.event_name}</div>
        <h1>{survey.title}</h1>
        <p className="intro-copy">{survey.intro}</p>
        <div className="intro-meta">
          <span>{survey.questions.length} questions</span>
          <span>
            About {Math.max(1, Math.round(survey.questions.length / 3))} minutes
          </span>
          <span>Anonymous</span>
        </div>
        <button className="primary" onClick={() => setStep(0)}>
          Let’s talk about it <span>→</span>
        </button>
        <p className="privacy">
          No login. No names, email addresses or phone numbers. Just your honest
          experience.
        </p>
        <div className="photos-shortcut">
          <h2>Just here for the photos?</h2>
          <p>Couldn’t make it? You’re still part of the community. Enjoy the photos, no survey needed.</p>
          <a className="text-link" href={survey.gallery_url}>Skip to the photos ↗</a>
        </div>
      </section>
    );
  return (
    <section className="card question-card">
      <div className="progress-meta">
        <span>{survey.event_name}</span>
        <strong>
          {step + 1} of {survey.questions.length}
        </strong>
      </div>
      <progress
        aria-label="Survey progress"
        value={step + 1}
        max={survey.questions.length}
      />
      <div key={q.id} className="question-enter">
        <p className="eyebrow">
          {q.required ? "Your experience" : "Optional · A little more room"}
        </p>
        <h1 ref={heading} tabIndex={-1}>
          {q.title}
        </h1>
        {q.help && <p>{q.help}</p>}
        <Question
          q={q}
          value={answers[q.id]}
          onChange={(v) => {
            setAnswers({ ...answers, [q.id]: v });
            setError("");
          }}
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="navigation">
        <button
          disabled={busy}
          onClick={() => {
            setError("");
            setStep(step - 1);
          }}
        >
          ← Back
        </button>
        <button className="primary" disabled={busy} onClick={next}>
          {busy
            ? "Sending…"
            : step === survey.questions.length - 1
              ? "Send feedback"
              : "Next →"}
        </button>
      </div>
      <p className="privacy">
        Anonymous feedback. Honest criticism is welcome.
      </p>
    </section>
  );
}
export default function App() {
  const segment = location.pathname.split("/").filter(Boolean)[1];
  const slug = !segment || segment === "index.html" ? "rb-karaoke" : segment;
  const [survey, setSurvey] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (slug === "admin") return;
    call("get", { slug })
      .then(setSurvey)
      .catch(() => setError("This survey is unavailable or has closed."));
  }, [slug]);
  return (
    <div className="feedback-shell">
      <header>
        <a href="/">
          <Brand weAre reversed width={152} />
        </a>
        <span>EVERY VOICE MATTERS</span>
      </header>
      <main>
        {slug === "admin" ? (
          <React.Suspense
            fallback={<p role="status">Opening Feedback Studio…</p>}
          >
            <Dashboard />
          </React.Suspense>
        ) : error ? (
          <section className="card">
            <h1>Thanks for stopping by.</h1>
            <p role="alert">{error}</p>
            <a href="/rcap-capsule/">Open the RCAP Capsule</a>
          </section>
        ) : survey ? (
          <SurveyFlow survey={survey} />
        ) : (
          <p role="status">Opening your survey…</p>
        )}
      </main>
      <footer>
        Ron Clark Academy Parents
        <br />
        Made better by all of us.
      </footer>
    </div>
  );
}
