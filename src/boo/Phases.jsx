import React, { useEffect, useRef, useState } from "react";
import { Camera, Ghost, Clock, Trophy, Check } from "lucide-react";
import { phaseAt, easternTime, countdown } from "./phases.js";
export function useGamePhase() {
  const [schedule, setSchedule] = useState(null),
    [error, setError] = useState(""),
    [tick, setTick] = useState(0),
    clock = useRef(null),
    inFlight = useRef(false);
  const reload = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const r = await fetch("/api/little-boo?action=phase", {
        cache: "no-store",
      });
      if (!r.ok)
        throw Error("The game schedule could not load. Please try again.");
      const next = await r.json();
      if (!phaseAt(next, Date.parse(next.serverNow)))
        throw Error("The game schedule could not load. Please try again.");
      clock.current = {
        server: Date.parse(next.serverNow),
        at: performance.now(),
      };
      setSchedule(next);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      inFlight.current = false;
    }
  };
  useEffect(() => {
    reload();
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const id = setInterval(() => setTick((t) => t + 1), 1000),
      sync = setInterval(reload, 60000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      clearInterval(id);
      clearInterval(sync);
    };
  }, []);
  const now = clock.current
    ? clock.current.server + (performance.now() - clock.current.at)
    : NaN;
  return { schedule, phase: phaseAt(schedule, now), now, error, reload };
}
export function PhaseStart({
  status,
  mode,
  onAdd,
  onGuess,
  onStandings,
  onRules,
}) {
  const { schedule, phase, now, error, reload } = status,
    isStudent = mode === "children";
  if (!phase)
    return (
      <section className="quick-start phase-start">
        <p className="game-promise">A little mystery is coming.</p>
        <p>{error || "Loading the game schedule…"}</p>
        {error && (
          <button className="gold" onClick={reload}>
            Retry loading schedule
          </button>
        )}
      </section>
    );
  return (
    <section className="quick-start phase-start" aria-label="This round">
      <div className="phase-pill">
        {phase === "submissions"
          ? "SUBMISSIONS OPEN · ADD YOUR STUDENT"
          : phase === "waiting" || phase === "soon"
            ? "NEXT UP · GUESSING"
            : phase === "guessing"
              ? "THE GUESSING ROUND IS OPEN"
              : phase === "closed"
                ? "GUESSING CLOSED"
                : "SUNDAY · RESULTS"}
      </div>
      {phase === "submissions" ? (
        <>
          <p className="game-promise">
            {isStudent ? "Add your kid." : "Add your throwback."}
            <br />
            <strong>
              {isStudent
                ? "Earn 3 contribution points."
                : "Join the adult bonus round."}
            </strong>
          </p>
          <p className="phase-copy">
            {isStudent
              ? "One photo per student. Siblings welcome."
              : "One childhood photo per adult. A separate bonus game."}
          </p>
          <button className="gold phase-primary" onClick={onAdd}>
            <Camera size={20} />
            {isStudent ? "Add your kid" : "Add your childhood photo"}
          </button>
          {!isStudent && (
            <p className="fine">
              Adult photos join the separate bonus round. Student upload points
              do not apply.
            </p>
          )}
          <p className="opening-callout">
            Guessing opens <b>{easternTime(schedule.guessesOpenAt)}.</b>
          </p>
          <p className="fine">
            Photo submissions end {easternTime(schedule.submissionsCloseAt)}.{" "}
            {isStudent
              ? "+3 once per student’s first accepted photo."
              : "Student contribution points do not apply to adult uploads."}
          </p>
        </>
      ) : phase === "waiting" || phase === "soon" ? (
        <>
          <p className="game-promise">
            Kids are in.
            <br />
            <strong>Guessing opens Friday at noon.</strong>
          </p>
          <p className="opening-callout">
            {easternTime(schedule.guessesOpenAt)}
          </p>
          <p className="phase-countdown" aria-label="Time until guessing opens">
            {countdown(schedule.guessesOpenAt, now)}
          </p>
          <p className="phase-copy">
            Submissions have closed. Come back for one guess per kid.
          </p>
        </>
      ) : phase === "guessing" ? (
        <>
          <p className="game-promise">
            Guess a kid.
            <br />
            <strong>Earn points. Win prizes.</strong>
          </p>
          <button className="gold phase-primary" onClick={onGuess}>
            <Ghost size={20} />
            {isStudent ? "Guess a kid" : "Guess a grown-up"}
          </button>
          <p className="quick-how">
            <b>5</b> first unaided · <b>3</b> later unaided · <b>1</b> with help
            <br />
            One committed guess per photo.
          </p>
          <p className="fine">
            Guessing closes {easternTime(schedule.guessesCloseAt)}.
          </p>
        </>
      ) : (
        <>
          <p className="game-promise">
            Guessing is closed.
            <br />
            <strong>
              {schedule.resultsPublished
                ? "Results are ready."
                : "Results Sunday, November 1."}
            </strong>
          </p>
          <p className="phase-copy">
            {schedule.resultsPublished
              ? "Organizer review and any required drawing are complete."
              : "The organizer reviews standings and draws among tied players for affected prize places."}
          </p>
          <button className="gold phase-primary" onClick={onStandings}>
            <Trophy size={20} />
            {schedule.resultsPublished
              ? "See results"
              : "See provisional standings"}
          </button>
        </>
      )}
      <button className="text-button phase-rules" onClick={onRules}>
        How points and prizes work
      </button>
    </section>
  );
}
export function OpeningNotice({
  session,
  notice,
  busy,
  onSave,
  onSignIn,
  status,
  focus,
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (focus) setExpanded(true);
  }, [focus]);
  const [choice, setChoice] = useState(!!notice?.optedIn);
  useEffect(() => setChoice(!!notice?.optedIn), [notice?.optedIn]);
  if (!["submissions", "waiting", "soon"].includes(status.phase)) return null;
  return (
    <details
      className="opening-notice"
      open={expanded}
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary>
        {notice?.optedIn
          ? "Opening-text request saved"
          : "Want one opening text?"}
      </summary>
      <p>
        Optional: request one text when guessing opens{" "}
        {easternTime(status.schedule.guessesOpenAt)}.
      </p>
      {session ? (
        <>
          <label className="consent">
            <input
              type="checkbox"
              checked={choice}
              onChange={(e) => setChoice(e.target.checked)}
              disabled={busy}
            />
            <span>
              I’d like one text about this game opening. No other game or
              marketing texts.
            </span>
          </label>
          <button
            disabled={busy || choice === !!notice?.optedIn}
            onClick={() => onSave(choice)}
          >
            {choice ? "Save my request" : "Withdraw my request"}
          </button>
          {notice?.optedIn && (
            <p className="request-saved">
              <Check size={14} /> Request saved.
            </p>
          )}
        </>
      ) : (
        <button onClick={onSignIn}>
          Sign in to save an opening-text request
        </button>
      )}
      <p className="fine">
        This saves your preference only. Opening texts are not scheduled yet,
        and saving this request does not send a text. Carrier rates may apply.
        You can withdraw here.
      </p>
    </details>
  );
}
export function OpeningAfterSubmit({ status, children }) {
  return (
    <div className="opening-after-submit">
      <Clock size={20} />
      <div>
        <b>Your photo is in.</b>
        <p>Guessing opens {easternTime(status.schedule?.guessesOpenAt)}.</p>
        {status.phase === "submissions" || status.phase === "waiting" ? (
          <strong>
            {countdown(status.schedule?.guessesOpenAt, status.now)}
          </strong>
        ) : null}
        {children}
      </div>
    </div>
  );
}
