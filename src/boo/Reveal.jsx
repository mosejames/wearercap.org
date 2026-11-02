import React, { useEffect, useRef, useState } from "react";
import PublicWinners from "./PublicWinners.jsx";
import Brand from "../components/Brand.jsx";
import { supabase } from "../vault/auth.js";
import { request } from "./api.js";
import { SignIn } from "./Onboarding.jsx";
import { placementLabel, entryLabel, ordinal } from "./reveal-model.js";
import "./style.css";
import "./reveal.css";
export function RevealImage({ entryId, portrait, preview = false, alt }) {
  const target = useRef(null),
    [visible, setVisible] = useState(false),
    [url, setUrl] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!target.current) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (rows) => {
        if (rows.some((r) => r.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "220px" },
    );
    observer.observe(target.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let active = true,
      current;
    request(preview ? "reveal-preview-media" : "reveal-media", {
      photoId: entryId,
      kind: portrait ? "now" : "then",
      ...(portrait ? { portraitId: portrait.id } : {}),
    })
      .then((value) => {
        current = value;
        if (active) setUrl(value);
        else URL.revokeObjectURL(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (current) URL.revokeObjectURL(current);
    };
  }, [visible, entryId, portrait?.id, preview]);
  return (
    <div className="reveal-image" ref={target}>
      {url ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          width="600"
          height="800"
        />
      ) : (
        <span role="status">
          {failed ? "Photo unavailable" : "Photo loading…"}
        </span>
      )}
    </div>
  );
}
export function RevealList({ data }) {
  return (
    <>
      <section className="reveal-score" aria-label="Your results">
        <span className="eyebrow">YOUR LITTLE BOO RESULTS</span>
        <h1>{data.me.display}</h1>
        <div className="reveal-score-number">
          {data.me.totalPoints}
          <span>TOTAL SCORE</span>
        </div>
        <p className="reveal-placement">{placementLabel(data.me)}</p>
        <details>
          <summary>How placement works</summary>
          <p>
            Ranked by total persisted student-game points, including upload
            bonuses. Only verified players with a committed student-game guess before closing are ranked, including zero-point guessers. Upload-only, organizer/staff, sign-in-only, adult-only and practice accounts do not count.
            Equal totals share a place, and the next rank skips the tied
            positions.
          </p>
        </details>
      </section>
      {data.topFive?.length > 0 && <section className="panel" aria-label="Top five guessers"><h2>Top five guessers</h2><p>Total points include photo contributions. Ties share a place; everyone tied at fifth is shown.</p><ol>{data.topFive.map((player,i)=><li key={i}>{ordinal(player.place)} · {player.display}{player.you ? " (you)" : ""} · {player.points} points{player.ties > 1 ? " · tied" : ""}</li>)}</ol><p>Your individual guesses remain private.</p></section>}
      <header className="reveal-list-heading">
        <span className="eyebrow">THEN &amp; NOW</span>
        <h2>Who was that little boo?</h2>
        <p>
          {data.entries.length} game{" "}
          {data.entries.length === 1 ? "entry" : "entries"}. Scroll to see your
          own results.
        </p>
      </header>
      <ol className="reveal-list">
        {data.entries.map((entry, index) => (
          <li className="reveal-entry" key={entry.id} data-entry-id={entry.id}>
            <span className="reveal-mystery">
              MYSTERY {String(index + 1).padStart(2, "0")}
            </span>
            <div className="reveal-pair">
              <section aria-label="Halloween throwback">
                <b>THEN</b>
                <RevealImage
                  entryId={entry.id}
                  preview={data.preview}
                  alt="The submitted Halloween throwback"
                />
              </section>
              <section aria-label="Current school portrait">
                <b>NOW</b>
                <div
                  className={
                    "reveal-portraits " +
                    (entry.portraits.length > 1 ? "combined" : "")
                  }
                >
                  {entry.portraits.length ? (
                    entry.portraits.map((p) => (
                      <RevealImage
                        key={p.id}
                        entryId={entry.id}
                        portrait={p}
                        preview={data.preview}
                        alt="The approved current school portrait"
                      />
                    ))
                  ) : (
                    <div className="reveal-image">
                      <span>Current portrait unavailable</span>
                    </div>
                  )}
                </div>
              </section>
            </div>
            <h3>{entry.displayNames.join(" & ")}</h3>
            {entry.grade && <p className="reveal-grade">{entry.grade}</p>}
            <p className={"reveal-result " + entry.status}>
              {entryLabel(entry)}
            </p>
            {entry.status === "own_child" && (
              <p className="reveal-entry-note">
                Not counted as an incorrect guess. Your upload contribution
                remains part of your total.
              </p>
            )}
            {entry.status === "unavailable" && (
              <p className="reveal-entry-note">
                No completed result was recorded for this photo.
              </p>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
export default function RevealPage() {
  const preview =
    new URLSearchParams(location.search).get("preview") === "organizer";
  const [session, setSession] = useState(null),
    [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [auth, setAuth] = useState({ phone: "", code: "", sent: false, sentAt: 0 });
  const generation = useRef(0),
    working = useRef(false);
  async function load() {
    const version = ++generation.current;
    setData(null);
    setError("");
    setLoading(true);
    try {
      const result = await supabase.auth.getSession();
      if (result.error) throw result.error;
      if (version !== generation.current) return;
      setSession(result.data.session);
      if (!result.data.session) return;
      const next = await request(preview ? "reveal-preview" : "reveal");
      if (version === generation.current) setData(next);
    } catch (e) {
      if (version === generation.current) setError(e.message);
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => queueMicrotask(load));
    return () => {
      generation.current++;
      subscription.unsubscribe();
    };
  }, []);
  async function run(task) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e.message);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="reveal-page">
      <header className="reveal-header">
        <Brand weAre reversed width={140} />
        <a href="/little-boo/">Back to Little Boo</a>
      </header>
      <PublicWinners />
      {preview && (
        <p className="reveal-private-banner">
          {data ? (data.publishedAt ? "ORGANIZER PREVIEW · REVEAL IS PUBLISHED" : "ORGANIZER PRIVATE PREVIEW · NOT PUBLISHED") : "ORGANIZER PREVIEW"}
        </p>
      )}
      {loading ? (
        <p className="panel" role="status">
          Loading your results…
        </p>
      ) : !session ? (
        <section className="panel reveal-signin">
          <SignIn
            run={run}
            busy={busy}
            onDone={load}
            auth={auth}
            setAuth={setAuth}
            draft={{}}
            intent="reveal"
            onBack={() => location.assign("/little-boo/")}
          />
        </section>
      ) : error ? (
        <section className="panel reveal-unavailable">
          <h1>The reveal isn’t available yet.</h1>
          <p role="alert">{error}</p>
          <p>
            Your guesses and points are saved. The organizer will open the
            reveal after review.
          </p>
          <button onClick={load}>Check again</button>
        </section>
      ) : data ? (
        <RevealList data={data} />
      ) : null}
      {!session && error && <p role="alert">{error}</p>}
      <footer className="reveal-footer">
        Your result badges and placement are shown only for your signed-in
        player.
      </footer>
    </div>
  );
}
