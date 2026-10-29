import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Ghost,
  Camera,
  Trophy,
  Sparkles,
  HelpCircle,
  Flag,
  Check,
  Lock,
  ChevronLeft,
  Volume2,
  VolumeX,
  Shield,
  Upload,
  X,
  Bell,
} from "lucide-react";
import { supabase } from "../vault/auth.js";
import { request } from "./api.js";
import Brand from "../components/Brand.jsx";
import {
  UploadFlow,
  SignIn,
  QuickScoring,
  usePhotoDraft,
} from "./Onboarding.jsx";
import { readJourney, saveJourney, defaultPlayerName } from "./journey.js";
import {
  useGamePhase,
  PhaseStart,
  OpeningNotice,
  OpeningAfterSubmit,
} from "./Phases.jsx";
import { easternTime } from "./phases.js";
import "./style.css";
const HOUSES = ["Amistad", "Altruismo", "Isibindi", "Reveur"];
const GRADES = ["4th", "5th", "6th", "7th", "8th", "Other / alumni"];
function App() {
  const gamePhase = useGamePhase();
  const [noticeFocus, setNoticeFocus] = useState(false);
  const [boardFilter, setBoardFilter] = useState("all");
  const [initialJourney] = useState(readJourney);
  const {
    draft,
    setDraft,
    choose,
    remove,
    clear: clearDraft,
  } = usePhotoDraft();
  const [journey, setJourney] = useState(initialJourney);
  const [lostPhoto, setLostPhoto] = useState(!!initialJourney?.hadPhoto);
  const [auth, setAuth] = useState({
    phone: "",
    code: "",
    sent: false,
    sentAt: 0,
  });
  const [reauthNeeded, setReauthNeeded] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const operation = useRef(false),
    boardRef = useRef(null),
    boardRequested = useRef(false),
    authUser = useRef(null),
    loadVersion = useRef(0);
  const [session, setSession] = useState(null),
    [ready, setReady] = useState(false),
    [mode, setMode] = useState(initialJourney?.mode || "children"),
    [data, setData] = useState(null),
    [tab, setTab] = useState("play"),
    [screen, setScreen] = useState(
      initialJourney?.kind === "upload"
        ? "upload"
        : ["guess", "notice", "standings"].includes(initialJourney?.kind)
          ? "signin"
          : null,
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [sound, setSound] = useState(false),
    [selected, setSelected] = useState(initialJourney?.photoId || null);
  useEffect(() => {
    let live = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setError(error.message);
        authUser.current = data.session?.user.id || null;
        setSession(data.session);
        setReady(true);
      })
      .catch(() => {
        if (live) {
          setReady(true);
          setError(
            "Sign-in could not load. You can still choose your photo and try again.",
          );
        }
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextId = next?.user.id || null;
      if (authUser.current !== nextId) {
        loadVersion.current++;
        setData(null);
      }
      if (authUser.current && nextId && authUser.current !== nextId) {
        clearDraft();
        setLostPhoto(false);
        setJourney(null);
        setNotice("Account changed. Choose your photo again for privacy.");
      }
      authUser.current = nextId;
      setSession(next);
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const marker =
      journey ||
      (draft.file || lostPhoto ? { kind: "upload", mode: draft.mode } : null);
    saveJourney(
      marker ? { ...marker, hadPhoto: !!draft.file || lostPhoto } : null,
    );
  }, [journey, draft.file, draft.mode, lostPhoto]);
  useEffect(() => {
    if (session && screen === "signin" && !reauthNeeded) {
      if (journey?.kind === "upload") setScreen("upload");
      else if (journey?.photoId) {
        setSelected(journey.photoId);
        setScreen("guess");
      } else if (journey?.kind === "standings") goStandings();
      else if (journey?.kind === "notice") {
        setScreen(null);
        setJourney(null);
        setNoticeFocus(true);
      } else goBoard();
    }
  }, [session, screen, reauthNeeded]);
  useEffect(() => {
    if (data && boardRequested.current) {
      boardRequested.current = false;
      boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [data, screen]);
  const refresh = async () => {
    if (session) {
      const version = ++loadVersion.current;
      const d = await request("get", { mode });
      if (version === loadVersion.current) setData(d);
      return d;
    }
  };
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    return () => {
      loadVersion.current++;
    };
  }, [session, mode, gamePhase.phase]);
  const run = async (fn) => {
    if (operation.current) return;
    operation.current = true;
    setError("");
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      if (
        e.status === 401 ||
        (e.status === 403 && /sign in|phone/i.test(e.message))
      ) {
        setReauthNeeded(true);
        setScreen("signin");
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  function goBoard() {
    setTab("play");
    setScreen(null);
    setJourney(null);
    boardRequested.current = true;
    setTimeout(() => {
      if (boardRef.current) {
        boardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        boardRequested.current = false;
      }
    }, 0);
  }
  function startUpload() {
    if (gamePhase.phase !== "submissions") {
      setNotice(
        "Photo submissions are closed. Guessing opens " +
          easternTime(gamePhase.schedule?.guessesOpenAt) +
          ".",
      );
      return;
    }
    const nextMode = draft.file ? draft.mode : mode;
    setMode(nextMode);
    if (!draft.file) setDraft((d) => ({ ...d, mode: nextMode }));
    setJourney({ kind: "upload", mode: nextMode });
    setError("");
    setScreen("upload");
  }
  function startGuess() {
    if (gamePhase.phase !== "guessing") {
      setNotice(
        "Guessing opens " +
          easternTime(gamePhase.schedule?.guessesOpenAt) +
          ".",
      );
      return;
    }
    setError("");
    setJourney({ kind: "guess", mode });
    if (!session) {
      setScreen("signin");
      return;
    }
    goBoard();
  }
  function goStandings() {
    setTab("board");
    setScreen(null);
    setJourney(null);
    boardRequested.current = true;
    setTimeout(
      () =>
        boardRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      0,
    );
  }
  function startStandings() {
    if (!session) {
      setJourney({ kind: "standings", mode });
      setScreen("signin");
    } else goStandings();
  }
  function requestNoticeSignIn() {
    setJourney({ kind: "notice", mode });
    setScreen("signin");
  }
  function closeDialog() {
    if (busy) return;
    setError("");
    setScreen(null);
    if (["guess", "notice", "standings"].includes(journey?.kind))
      setJourney(null);
  }
  async function ensureProfile(b) {
    if (data?.me) return data.me;
    await request("profile", {
      display: defaultPlayerName(data?.userId || session?.user.id),
      house: b.house,
      grade: b.grade,
      ownNames: b.ownNames || [],
    });
    return { house: b.house, grade: b.grade };
  }
  async function authDone() {
    const { data: next, error } = await supabase.auth.getSession();
    if (error || !next.session)
      throw Error("Your sign-in did not finish. Your photo is still here.");
    setSession(next.session);
    setReauthNeeded(false);
    if (journey?.kind === "upload") setScreen("upload");
    else if (journey?.photoId) {
      setSelected(journey.photoId);
      setScreen("guess");
    } else if (journey?.kind === "standings") goStandings();
    else if (journey?.kind === "notice") {
      setScreen(null);
      setJourney(null);
      setNoticeFocus(true);
    } else goBoard();
  }
  function cheer() {
    if (sound) {
      try {
        const c = new AudioContext();
        [523, 659, 784].forEach((f, i) => {
          const o = c.createOscillator(),
            g = c.createGain();
          o.frequency.value = f;
          g.gain.value = 0.04;
          o.connect(g);
          g.connect(c.destination);
          o.start(c.currentTime + i * 0.12);
          o.stop(c.currentTime + i * 0.12 + 0.16);
        });
        setTimeout(() => c.close(), 700);
      } catch {}
    }
  }
  const visiblePhotos =
    data?.photos.filter((p) =>
      mode !== "children" ||
      !["guessing", "closed", "results"].includes(gamePhase.phase) ||
      boardFilter === "all"
        ? true
        : boardFilter === "grade"
          ? p.grade === data.me?.grade
          : p.house === data.me?.house,
    ) || [];
  const photo = selected && data?.photos.find((p) => p.id === selected);
  const correct = data?.photos.filter((p) => p.correct).length || 0,
    eligible = data?.photos.filter((p) => !p.own).length || 0;
  return (
    <div className="show">
      <div className="ambient" aria-hidden="true">
        <Ghost className="drifter one" />
        <Ghost className="drifter two" />
      </div>
      <header className="top">
        <a
          className="brand boo-brand"
          href="/little-boo/"
          onClick={(e) => {
            e.preventDefault();
            closeDialog();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <Brand weAre reversed width={138} />
          <span>HALLOWEEN SPECIAL</span>
        </a>
        <div className="top-actions">
          <button
            className="icon"
            aria-label={
              sound ? "Mute celebrations" : "Enable celebration sounds"
            }
            aria-pressed={sound}
            onClick={() => setSound(!sound)}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </button>
          {session && (
            <button
              className="icon"
              aria-label="Your notifications"
              onClick={() => setScreen("inbox")}
            >
              <Bell />
            </button>
          )}
        </div>
      </header>
      <section className="hero">
        <div className="on-air">
          <i /> THE FAMILY GUESSING SHOW
        </div>
        <div className="marquee">
          <div className="eyebrow">RCAP PRESENTS</div>
          <h1>
            Who’s That
            <br />
            <span>Little Boo?</span>
            <Ghost className="title-ghost" aria-hidden="true" />
          </h1>
          <p>A We Are RCAP Guess Who Game</p>
        </div>
        <PhaseStart
          status={gamePhase}
          mode={mode}
          onAdd={startUpload}
          onGuess={startGuess}
          onStandings={startStandings}
          onRules={() => setScreen("rules")}
        />
        {justAdded > 0 && (
          <div className="added-badge">
            <Check size={16} /> +{justAdded} contribution points. One bonus per
            student.
          </div>
        )}
        <div className="prize-strip">
          <Trophy />
          <span>THE PODIUM PRIZES</span>
          <b>
            1st <em>25</em>
          </b>
          <b>
            2nd <em>15</em>
          </b>
          <b>
            3rd <em>10</em>
          </b>
          <small>raffle tickets</small>
        </div>
        <p className="fine">
          Individual prizes. Organizer drawing for tied prize places. Results
          Sunday, November 1. Tickets are issued by the organizer after review,
          never automatically.
        </p>
      </section>
      <main>
        {error && (
          <div className="message error" role="alert">
            {error}
            <button
              className="icon"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X />
            </button>
          </div>
        )}
        {notice && (
          <div className="message" role="status">
            {notice}
            <button
              className="icon"
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X />
            </button>
          </div>
        )}
        {(draft.file || lostPhoto) &&
          screen !== "upload" &&
          screen !== "signin" && (
            <div className="draft-banner" role="status">
              <div>
                <b>
                  {draft.file
                    ? "Your photo is still here."
                    : "Your photo needs reselecting."}
                </b>
                <span>
                  {draft.file
                    ? "Not posted. Finish adding it whenever you’re ready."
                    : "The tab restarted. For privacy, photos stay in memory only."}
                </span>
              </div>
              <button onClick={startUpload}>
                {draft.file ? "Continue adding" : "Choose photo again"}
              </button>
            </div>
          )}
        <OpeningNotice
          status={gamePhase}
          session={session}
          notice={data?.openingNotice}
          busy={busy}
          focus={noticeFocus}
          onSignIn={requestNoticeSignIn}
          onSave={(choice) =>
            run(async () => {
              await request("opening-notice", { optedIn: choice });
              await refresh();
              setNotice(
                choice
                  ? "Opening-text request saved. Texts are not scheduled yet."
                  : "Opening-text request withdrawn.",
              );
            })
          }
        />
        {!session ? (
          <p className="entry-privacy">
            <Lock size={13} /> Your phone stays private. Sign-in verifies a
            phone, not school membership. This link can be forwarded.
          </p>
        ) : !data ? (
          <div className="panel">
            <p>Lighting up your stage…</p>
            <button onClick={() => run(refresh)}>Try loading again</button>
          </div>
        ) : (
          <>
            <div className="mode-switch" role="group" aria-label="Game mode">
              <button
                className={mode === "children" ? "active" : ""}
                onClick={() => {
                  if (mode !== "children") {
                    setData(null);
                    setMode("children");
                  }
                  setSelected(null);
                }}
              >
                Little Boos <span>CHILDREN</span>
              </button>
              <button
                className={mode === "adults" ? "active" : ""}
                onClick={() => {
                  if (mode !== "adults") {
                    setData(null);
                    setMode("adults");
                  }
                  setSelected(null);
                }}
              >
                Ghosts of Halloweens Past <span>ADULT BONUS</span>
              </button>
            </div>
            <div className="scoreboard">
              <div>
                <span>YOUR SCORE</span>
                <b>
                  {data.board.individual.find((p) => p.id === data.userId)
                    ?.points || 0}
                  <small>PTS</small>
                </b>
              </div>
              <div>
                <span>
                  {["submissions", "waiting", "soon"].includes(gamePhase.phase)
                    ? mode === "children"
                      ? "STUDENTS ADDED"
                      : "THROWBACKS ADDED"
                    : mode === "children"
                      ? "LITTLE BOOS IDENTIFIED"
                      : "GHOSTS IDENTIFIED"}
                </span>
                <b>
                  {["submissions", "waiting", "soon"].includes(
                    gamePhase.phase,
                  ) ? (
                    data.photos.filter((p) => p.own).length
                  ) : (
                    <>
                      {correct}
                      <small>/ {eligible}</small>
                    </>
                  )}
                </b>
              </div>
              {mode === "children" && (
                <p className="score-breakdown">
                  {data.board.individual.find((p) => p.id === data.userId)
                    ?.guessPoints || 0}{" "}
                  guess points ·{" "}
                  {data.board.individual.find((p) => p.id === data.userId)
                    ?.uploadPoints || 0}{" "}
                  contribution points
                </p>
              )}
            </div>
            {["guessing", "closed", "results"].includes(gamePhase.phase) && (
              <nav className="tabs" aria-label="Game views">
                <button
                  className={tab === "play" ? "active" : ""}
                  onClick={() => setTab("play")}
                >
                  <Ghost /> Play the board
                </button>
                <button
                  className={tab === "board" ? "active" : ""}
                  onClick={() => setTab("board")}
                >
                  <Trophy /> Leaderboards
                </button>
                <button
                  className={tab === "rules" ? "active" : ""}
                  onClick={() => setTab("rules")}
                >
                  <HelpCircle /> How to play
                </button>
              </nav>
            )}
            <div ref={boardRef} />
            {["submissions", "waiting", "soon"].includes(gamePhase.phase) &&
              session &&
              data.photos.some((p) => p.own) && (
                <OpeningAfterSubmit status={gamePhase}>
                  <p className="fine">
                    Each student’s first accepted photo earns 3 contribution
                    points. Siblings can each have one photo.
                  </p>
                  {gamePhase.phase === "submissions" && (
                    <button className="text-button" onClick={startUpload}>
                      Add another student
                    </button>
                  )}
                </OpeningAfterSubmit>
              )}
            {tab === "play" && (
              <>
                <div className="section-title">
                  <div>
                    <span className="eyebrow">
                      {mode === "children"
                        ? "THE MYSTERY BOARD"
                        : "THE BONUS ROUND"}
                    </span>
                    <h2>
                      {mode === "children"
                        ? ["submissions", "waiting", "soon"].includes(
                            gamePhase.phase,
                          )
                          ? "Your submitted students"
                          : "Guess a kid."
                        : ["submissions", "waiting", "soon"].includes(
                              gamePhase.phase,
                            )
                          ? "Your submitted throwbacks"
                          : "Guess a grown-up."}
                    </h2>
                  </div>
                  <span className="count">
                    {data.photos.length} on the board
                  </span>
                </div>
                <p className="board-guide">
                  {gamePhase.phase === "guessing"
                    ? "Tap a photo. Type a name or choose help. Then lock in your one guess."
                    : ["submissions", "waiting", "soon"].includes(
                          gamePhase.phase,
                        )
                      ? "Your accepted photos are safe here. Other families’ photos unlock when guessing opens."
                      : "Guessing is closed. Standings remain provisional until organizer review and any drawing."}
                </p>
                {mode === "children" &&
                  ["guessing", "closed", "results"].includes(
                    gamePhase.phase,
                  ) && (
                    <div
                      className="board-filters"
                      role="group"
                      aria-label="Find little boos"
                    >
                      {[
                        ["all", "All little boos"],
                        ["grade", "My grade"],
                        ["house", "My house"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          aria-pressed={boardFilter === value}
                          disabled={value !== "all" && !data.me}
                          onClick={() => setBoardFilter(value)}
                        >
                          {label}
                        </button>
                      ))}
                      <p className="fine">
                        Everyone can guess every grade. Filters only change this
                        view.
                        {!data.me &&
                          " Choose your scoring house and grade when making your first guess to use these filters."}
                      </p>
                    </div>
                  )}
                {gamePhase.phase === "guessing" &&
                  data.photos.length > 0 &&
                  !data.photos.some((p) => !p.own && !p.submitted) && (
                    <div className="next-kid">
                      <p>
                        {eligible === 0
                          ? "Your kid is on the board. Other families’ photos will appear here to guess."
                          : "You’ve played every available mystery. Check for new kids soon."}
                      </p>
                      <button disabled={busy} onClick={() => run(refresh)}>
                        Check for more kids
                      </button>
                    </div>
                  )}
                {!data.photos.length ? (
                  <section className="empty panel">
                    <div className="empty-cards">
                      <Ghost />
                      <Camera />
                      <Ghost />
                    </div>
                    <h2>
                      {justAdded
                        ? "Your kid is in. Who’s next?"
                        : "The first mystery could be yours."}
                    </h2>
                    <p>
                      One early Halloween photo. No crop required.
                      <br />
                      {justAdded
                        ? "Other families’ photos will appear here to guess."
                        : "Your throwback joins the board as soon as you submit."}
                    </p>
                    <p>
                      {gamePhase.phase === "submissions"
                        ? "Use “Add your kid” above to submit one photo for each student. Siblings are welcome."
                        : gamePhase.phase === "waiting"
                          ? "Guessing opens Friday, October 30 at noon Eastern."
                          : "No mysteries to show yet."}
                    </p>
                    <p className="fine">
                      Try one of their first three Halloweens, or the earliest
                      photo you have.
                    </p>
                  </section>
                ) : (
                  <div className="cards">
                    {!visiblePhotos.length && (
                      <p className="panel">
                        No little boos in this view. Choose “All little boos” to
                        explore every grade.
                      </p>
                    )}
                    {visiblePhotos.map((p) => (
                      <button
                        key={p.id}
                        className={
                          "card " +
                          (p.submitted ? "flipped " : "") +
                          (p.correct ? "solved" : "")
                        }
                        onClick={() => {
                          setSelected(p.id);
                          setJourney({ kind: "guess", mode, photoId: p.id });
                          setScreen("guess");
                        }}
                      >
                        <div className="photo-wrap">
                          <Photo id={p.id} />
                          {p.correct ? (
                            <span className="stamp">
                              <Check /> IDENTIFIED
                            </span>
                          ) : p.submitted ? (
                            <span className="stamp missed">ROUND COMPLETE</span>
                          ) : p.own ? (
                            <span className="stamp own">YOUR LITTLE BOO</span>
                          ) : null}
                        </div>
                        <div className="card-caption">
                          <span>
                            MYSTERY{" "}
                            {String(data.photos.indexOf(p) + 1).padStart(
                              2,
                              "0",
                            )}
                          </span>
                          <b>
                            {p.correct
                              ? `+${p.points} points`
                              : p.own
                                ? "Cheer them on"
                                : p.submitted
                                  ? "One guess, all done"
                                  : "Who could it be?"}{" "}
                            <Ghost size={20} />
                          </b>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {gamePhase.phase === "guessing" && (
                  <p className="help-line">
                    <HelpCircle size={17} />
                    {data.distinctChildren < 10
                      ? `A little help unlocks at 10 distinct children. ${data.distinctChildren} have joined so far.`
                      : "A little help is open. Choose it before committing your one guess."}
                  </p>
                )}
              </>
            )}
            {tab === "board" && <Boards data={data} mode={mode} />}
            {tab === "rules" && <Rules />}
            <div className="footer-tools">
              <button onClick={() => setScreen("profile")}>
                Player profile
              </button>
              {data.isAdmin && (
                <button onClick={() => setScreen("admin")}>
                  <Shield size={14} /> Organizer desk
                </button>
              )}
              <button
                onClick={() => {
                  clearDraft();
                  setLostPhoto(false);
                  setJourney(null);
                  setAuth({ phone: "", code: "", sent: false, sentAt: 0 });
                  supabase.auth.signOut();
                }}
              >
                Sign out
              </button>
            </div>
          </>
        )}
        <footer>
          <div className="footer-brand">
            <Brand weAre reversed width={100} />
          </div>
          <span>A little mystery. A lot of community.</span>
          <p>
            One photo per student. Siblings welcome. No public answer reveals.
            Photos can be reported or removed.
          </p>
        </footer>
      </main>
      {screen && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={screen === "guess" ? "Make your guess" : screen}
            tabIndex={-1}
          >
            <button
              className="close icon"
              aria-label="Close dialog"
              onClick={closeDialog}
              disabled={busy}
            >
              <X />
            </button>
            {screen === "signin" && (
              <SignIn
                run={run}
                busy={busy}
                onDone={authDone}
                auth={auth}
                setAuth={setAuth}
                draft={draft}
                intent={journey?.kind || "guess"}
                onBack={() => {
                  setError("");
                  if (journey?.kind === "upload") setScreen("upload");
                  else closeDialog();
                }}
              />
            )}
            {screen === "profile" && (
              <Profile
                me={data?.me || { display: defaultPlayerName(data?.userId) }}
                run={run}
                busy={busy}
                onSave={async (b) => {
                  await request("profile", b);
                  await refresh();
                  setScreen(null);
                }}
              />
            )}
            {screen === "rules" && <Rules />}
            {screen === "upload" && (
              <UploadFlow
                draft={draft}
                setDraft={setDraft}
                choose={(file) => {
                  setLostPhoto(false);
                  choose(file);
                }}
                remove={() => {
                  remove();
                  setLostPhoto(false);
                }}
                mode={draft.file ? draft.mode : mode}
                session={session}
                ready={ready}
                loaded={!!data}
                canUpload={
                  gamePhase.phase ? gamePhase.phase === "submissions" : null
                }
                openingLabel={easternTime(gamePhase.schedule?.guessesOpenAt)}
                onLeave={closeDialog}
                onRetry={refresh}
                lostPhoto={lostPhoto}
                me={data?.me}
                run={run}
                busy={busy}
                onSignIn={() => {
                  setJourney({ kind: "upload", mode: draft.mode });
                  setScreen("signin");
                }}
                onSave={async (b) => {
                  if (gamePhase.phase !== "submissions")
                    throw Error(
                      "Photo submissions have closed. Guessing opens " +
                        easternTime(gamePhase.schedule?.guessesOpenAt) +
                        ".",
                    );
                  await ensureProfile({
                    ...b,
                    ownNames: mode === "children" ? [b.name] : [],
                  });
                  const accepted = await request("upload", { ...b, mode });
                  clearDraft();
                  setLostPhoto(false);
                  setJustAdded(
                    mode === "children" && accepted.uploadBonus === 3 ? 3 : 0,
                  );
                  setNotice(
                    mode === "children"
                      ? `Your student is in!${accepted.uploadBonus === 3 ? " +3 contribution points." : ""} Guessing opens ${easternTime(gamePhase.schedule?.guessesOpenAt)}.`
                      : `Your throwback is in. Adult guessing opens ${easternTime(gamePhase.schedule?.guessesOpenAt)}.`,
                  );
                  goBoard();
                  await refresh();
                  await gamePhase.reload();
                }}
              />
            )}
            {screen === "guess" && !data && (
              <div>
                <p role="status">Loading the board. Your next step is ready…</p>
                <button disabled={busy} onClick={() => run(refresh)}>
                  Retry loading the board
                </button>
              </div>
            )}
            {screen === "guess" && photo && (
              <Guess
                photo={photo}
                needsProfile={!data.me}
                canGuess={gamePhase.phase === "guessing"}
                phase={gamePhase.phase}
                openingLabel={easternTime(gamePhase.schedule?.guessesOpenAt)}
                onProfile={async (b) => {
                  await ensureProfile(b);
                  await refresh();
                }}
                mode={mode}
                count={data.distinctChildren}
                busy={busy}
                run={run}
                onHint={async () => {
                  await request("hint", { id: photo.id });
                  await refresh();
                }}
                onGuess={async (guess) => {
                  const r = await request("guess", { id: photo.id, guess });
                  if (r.rateLimited) throw Error(r.message);
                  await refresh();
                  if (r.correct) {
                    setNotice(`You got it! +${r.points} points.`);
                    cheer();
                  } else
                    setNotice(
                      "That wasn’t the one. This mystery is complete for you. On to the next little boo!",
                    );
                }}
                onReport={async (reason) => {
                  await request("report", { id: photo.id, reason });
                  setNotice(
                    "Report sent to the organizer. Thank you for looking out for our families.",
                  );
                  setScreen(null);
                }}
                onRemove={async () => {
                  await request("remove", { id: photo.id });
                  await refresh();
                  setScreen(null);
                }}
              />
            )}
            {screen === "inbox" && (
              <>
                <span className="eyebrow">YOUR GREEN ROOM</span>
                <h2>Little updates</h2>
                {data?.notifications.length ? (
                  data.notifications.map((n) => (
                    <p className="notification" key={n.id}>
                      {n.message}
                    </p>
                  ))
                ) : (
                  <p>
                    No notifications yet. Your game milestones will appear here.
                  </p>
                )}
              </>
            )}
            {screen === "admin" && (
              <Admin run={run} busy={busy} refresh={refresh} />
            )}
            <div className="modal-status" role="status">
              {busy ? "Working a little magic…" : error}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function Photo({ id }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true,
      current;
    request("media", { id })
      .then((u) => {
        current = u;
        if (active) setUrl(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (current) URL.revokeObjectURL(current);
    };
  }, [id]);
  return url ? (
    <img src={url} alt="A mystery Halloween throwback" loading="lazy" />
  ) : (
    <div className="photo-loading">
      <Ghost />
    </div>
  );
}
function Profile({ me, run, busy, onSave }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() =>
          onSave({
            display: f.get("display"),
            house: f.get("house"),
            grade: f.get("grade"),
            ownNames: String(f.get("ownNames"))
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          }),
        );
      }}
    >
      <span className="eyebrow">YOUR CONTESTANT CARD</span>
      <h2>Your name in lights</h2>
      <label>
        Public player name
        <input
          name="display"
          defaultValue={me?.display}
          maxLength={40}
          minLength={2}
          required
          placeholder="A name other families will recognize"
        />
      </label>
      <Affiliations me={me} />
      <label>
        Your children’s full names, separated by commas
        <input
          name="ownNames"
          maxLength={500}
          placeholder="Private. Prevents scoring on your own children."
        />
      </label>
      <p className="fine">
        Choose one house and one grade for all your points, even if your
        children span several. These lock after your first point. Child names
        stay private and self-exclusions cannot be undone.
      </p>
      <button className="gold" disabled={busy}>
        Save my player
      </button>
    </form>
  );
}
function Affiliations({ me }) {
  return (
    <div className="two-fields">
      <label>
        House
        <select name="house" defaultValue={me?.house || ""} required>
          <option value="" disabled>
            Choose a house
          </option>
          {HOUSES.map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
      </label>
      <label>
        Grade / class
        <select name="grade" defaultValue={me?.grade || ""} required>
          <option value="" disabled>
            Choose a grade
          </option>
          {GRADES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
function Guess({
  canGuess,
  phase,
  openingLabel,
  needsProfile,
  onProfile,
  mode,
  photo,
  count,
  busy,
  run,
  onHint,
  onGuess,
  onReport,
  onRemove,
}) {
  const [guess, setGuess] = useState(""),
    [confirm, setConfirm] = useState(false),
    [report, setReport] = useState(false),
    [reason, setReason] = useState("");
  useEffect(() => {
    setGuess(photo.pendingGuess || "");
    setConfirm(false);
  }, [photo.id]);
  return (
    <>
      <span className="eyebrow">THE MOMENT OF BOO-TH</span>
      <h2>
        {photo.correct
          ? "You know this little boo!"
          : photo.submitted
            ? "This round is complete."
            : "Who’s behind the costume?"}
      </h2>
      <div className="guess-photo">
        <Photo id={photo.id} />
      </div>
      {photo.own ? (
        <p className="message">
          Your own mystery. No guessing points for your own child or submission.
          The first accepted student photo earns a separate 3-point contribution
          bonus.
        </p>
      ) : photo.submitted ? (
        <p className="message">
          {photo.correct
            ? `✓ Identified! You earned ${photo.points} points.`
            : "One guess was your shot. The answer stays a mystery for everyone else."}
        </p>
      ) : !canGuess ? (
        <p className="message">
          {phase === "submissions" || phase === "waiting" || phase === "soon"
            ? "Guessing opens " + openingLabel + "."
            : "Guessing has closed. Results are Sunday after organizer review."}
        </p>
      ) : needsProfile ? (
        <QuickScoring busy={busy} run={run} onSave={onProfile} mode={mode} />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!confirm) {
              setConfirm(true);
              return;
            }
            run(() => onGuess(guess));
          }}
        >
          <label>
            Your one guess
            <input
              value={guess}
              onChange={(e) => {
                setGuess(e.target.value);
                setConfirm(false);
              }}
              required
              maxLength={100}
              minLength={2}
              placeholder="Full name or an accepted nickname"
              autoComplete="off"
              disabled={busy}
            />
          </label>
          {photo.hinted ? (
            <div className="choices">
              {photo.choices?.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={guess === c ? "chosen" : ""}
                  onClick={() => {
                    setGuess(c);
                    setConfirm(false);
                  }}
                >
                  {c}
                </button>
              ))}
              <p className="fine">
                Help used. A correct guess earns 1 point, even if typed.
              </p>
            </div>
          ) : (
            <button
              type="button"
              className="hint"
              disabled={busy || count < 10 || confirm}
              onClick={() => run(onHint)}
            >
              <HelpCircle size={17} /> A little help{" "}
              <span>
                {count < 10
                  ? "Unlocks at 10 children"
                  : "Makes this a 1-point guess"}
              </span>
            </button>
          )}
          {confirm && (
            <p className="commit-warning">
              Lock in “{guess}”? This is your only submitted guess for this
              photo. A wrong answer completes your round.
            </p>
          )}
          <button className="gold" disabled={busy}>
            {photo.pending
              ? "Resume spelling check"
              : confirm
                ? "Yes, lock it in"
                : "Review my guess"}{" "}
            <Lock size={16} />
          </button>
        </form>
      )}
      <div className="photo-tools">
        <button className="text-button" onClick={() => setReport(!report)}>
          <Flag size={15} /> Report photo
        </button>
        {photo.canRemove && (
          <button
            className="text-button"
            onClick={() => {
              if (
                window.confirm(
                  "Remove this photo from the game? Its guessing points and 3-point student contribution bonus will no longer count. Removing or re-uploading cannot earn another bonus. This student cannot be resubmitted during this round.",
                )
              )
                run(onRemove);
            }}
          >
            Remove photo
          </button>
        )}
      </div>
      {report && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => onReport(reason));
          }}
        >
          <label>
            What should the organizer know?
            <textarea
              required
              minLength={3}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button disabled={busy}>Send report</button>
        </form>
      )}
    </>
  );
}
function Boards({ data, mode }) {
  const [type, setType] = useState("individual");
  const rows = data.board[type];
  return (
    <section className="panel leaderboard">
      <span className="eyebrow">THE SCOREBOARD</span>
      <h2>
        {mode === "children"
          ? "A little friendly competition"
          : "Ghosts of Halloweens Past"}
      </h2>
      {mode === "adults" && (
        <p>
          Bonus scores stay separate. Adult play does not affect children’s
          prizes or house and grade totals.
        </p>
      )}
      {data.awards && (
        <div className="reviewed-results">
          <h3>Organizer-reviewed prize report</h3>
          {data.awards
            .filter((r) => r.tickets > 0)
            .sort(
              (a, b) => (a.awardedPlace || a.rank) - (b.awardedPlace || b.rank),
            )
            .map((r) => (
              <p key={r.playerId}>
                <b>{r.display}</b> · {r.tickets} raffle tickets for organizer
                fulfillment
              </p>
            ))}
        </div>
      )}
      <div className="board-tabs">
        {["individual", "house", "grade"].map((t) => (
          <button
            className={t === type ? "active" : ""}
            key={t}
            onClick={() => setType(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {!rows.length ? (
        <div className="empty">
          <Trophy size={40} />
          <h3>The lights are on. The scores are next.</h3>
          <p>
            Accepted student photos and correct guesses bring this board to
            life.
          </p>
        </div>
      ) : (
        rows.map((r, i) => (
          <div className="board-row" key={r.id || r.label}>
            <b className="rank">{i + 1}</b>
            <div>
              <strong>{r.display || r.label}</strong>
              {r.display && (
                <small>
                  {r.house} · {r.grade} · {r.identified} identified
                  {mode === "children" && (
                    <span className="point-sources">
                      {r.guessPoints || 0} guess + {r.uploadPoints || 0}{" "}
                      contribution
                    </span>
                  )}
                </small>
              )}
            </div>
            <b>
              {r.points}
              <small>PTS</small>
            </b>
          </div>
        ))
      )}
      <p className="fine">
        Student totals combine guess points and a separate 3-point bonus per
        student’s first accepted photo. Guessing closes Saturday, October 31 at
        11:59 p.m. Eastern. Organizer drawing settles tied prize places. Results
        Sunday, November 1. No tickets are issued by this app.
      </p>
    </section>
  );
}
function Rules() {
  return (
    <section className="panel prose">
      <span className="eyebrow">THE RULES OF THE SHOW</span>
      <h2>One photo. One shot. All the fun.</h2>
      <ol>
        <li>
          Parents share one early Halloween photo per student. Siblings can each
          have a photo and each first accepted student photo earns 3
          contribution points. Adults can share their own childhood photo in the
          separate bonus round.
        </li>
        <li>
          Type a full name or a supplied nickname. You may edit freely before
          you lock it in. A wrong committed guess ends that photo for you.
        </li>
        <li>
          Choose “A little help” before submitting if you want four real
          submitted names. It unlocks after 10 distinct children and permanently
          makes that photo worth 1 point for you.
        </li>
        <li>
          The first unaided correct guess earns 5 points. Later unaided correct
          guesses earn 3. Each player scores once per photo. A hinted correct
          does not claim the first unaided prize.
        </li>
        <li>
          No guessing points on your own child or submission. The 3-point
          student contribution bonus is separate. Tell us your children’s names
          in your profile so we can exclude them.
        </li>
        <li>
          Pick one house and grade to support. They lock after your first point.
          Guess points are per identified student. The separate contribution
          bonus is once per student, never for replacements or retries. One
          photo per student; siblings welcome. Duplicate names/photos are
          rejected.
        </li>
      </ol>
      <p>
        Photo submissions close Friday, October 30 at 11:59 a.m. Eastern.
        Guessing: Friday, October 30 at noon Eastern through Saturday, October
        31 at 11:59 p.m. Eastern. Results: Sunday, November 1 after organizer
        review and drawings for tied prize places. Removing a photo removes its
        live guess points and contribution bonus, but its permanent receipt
        prevents earning the bonus again.
      </p>
      <h3>Privacy and fair play</h3>
      <p>
        Sign-in verifies a phone number, not school membership. The link can be
        forwarded. Authenticated, consented submissions are accepted immediately
        without premoderation. Other families’ photos are viewable when guessing
        opens. Submit only what you are comfortable sharing with other signed-in
        players, who can take screenshots.
      </p>
      <p>
        Names and answer lists are kept out of the public page. Help reveals
        only four submitted candidates for that mystery. Correct answers are
        personal checkmarks, never global reveals. Reports go to the organizer.
        Uploaders and organizers can remove photos; removed photos no longer
        count toward scores.
      </p>
      <p>
        Expected nicknames should be supplied during upload. Unexpected close
        spellings can be held for review when the optional AI spelling service
        is unavailable. A service failure does not consume your guess. Photos
        are never used for identity recognition.
      </p>
    </section>
  );
}
function Admin({ run, busy, refresh }) {
  const [d, setD] = useState(null);
  const load = () => request("admin").then(setD);
  useEffect(() => {
    load().catch(() => {});
  }, []);
  if (!d) return <p>Opening organizer desk…</p>;
  return (
    <>
      <span className="eyebrow">ORGANIZER DESK</span>
      <h2>Keep the show kind.</h2>
      <h3>Reports</h3>
      {!d.reports.length ? (
        <p>No reports.</p>
      ) : (
        d.reports.map((r) => (
          <div className="admin-report" key={r.id}>
            <Photo id={r.photo} />
            <p>{r.reason}</p>
            <small>
              {r.state} · {r.resolved ? "resolved" : "open"}
            </small>
            <button
              disabled={busy || r.state === "removed"}
              onClick={() =>
                run(async () => {
                  await request("remove", { id: r.photo });
                  await load();
                  await refresh();
                })
              }
            >
              Remove photo
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await request("resolve", { id: r.photo });
                  await load();
                })
              }
            >
              Mark resolved
            </button>
          </div>
        ))
      )}
      <h3>Confirmed round schedule</h3>
      <p>
        Photo submissions end Friday, October 30 at 11:59 a.m. Eastern. Guessing
        opens Friday, October 30 at noon Eastern and closes Saturday, October 31
        at 11:59 p.m. Eastern. Results Sunday, November 1. Opening-text
        requests: {d.openingNoticeRequests || 0}. None are scheduled by this
        app.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(async () => {
            await request("settings", {
              closesAt: f.get("closesAt"),
              timezone: f.get("timezone"),
              tieRule: f.get("tieRule"),
            });
            await load();
            await refresh();
          });
        }}
      >
        <label>
          Closing time, ISO with timezone offset
          <input
            name="closesAt"
            defaultValue={d.settings.closes_at || ""}
            placeholder="Not finalized. Example: 2026-10-31T20:00:00-04:00"
          />
        </label>
        <label>
          Display timezone
          <input name="timezone" defaultValue={d.settings.timezone} />
        </label>
        <label>
          Tie rule
          <select name="tieRule" defaultValue={d.settings.tie_rule}>
            <option value="drawing">
              Organizer drawing for tied prize places
            </option>
            <option value="unsettled">Not settled</option>
            <option value="shared-rank">
              Shared rank, same prize for ties
            </option>
            <option value="earliest-score">
              Earliest reaching final score
            </option>
          </select>
        </label>
        <button disabled={busy || !!d.settings.finalized_at}>
          Save round settings
        </button>
      </form>
      <h3>Final prize report</h3>
      <p>
        After closing, freeze the standings for organizer review. Tied podium
        places require an organizer drawing. Nothing is drawn automatically, and
        this does not issue tickets or change raffle records.
      </p>
      <button
        disabled={busy || !!d.settings.finalized_at}
        onClick={() => {
          if (
            window.confirm(
              "Freeze final standings? This cannot be edited from the app. No tickets will be issued.",
            )
          )
            run(async () => {
              await request("finalize");
              await load();
            });
        }}
      >
        Finalize standings
      </button>
      {d.awards && (
        <>
          {d.awards.some((row) => row.drawingRequired) && (
            <DrawingForm
              awards={d.awards}
              busy={busy}
              run={run}
              onSave={async (placements) => {
                await request("drawing-results", {
                  placements,
                  confirmed: true,
                });
                await load();
                await refresh();
              }}
            />
          )}
          <pre>{JSON.stringify(d.awards, null, 2)}</pre>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(d.awards, null, 2)], {
                  type: "application/json",
                }),
                url = URL.createObjectURL(blob),
                a = document.createElement("a");
              a.href = url;
              a.download = "little-boo-prize-report.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download award report
          </button>
        </>
      )}
    </>
  );
}
function DrawingForm({ awards, busy, run, onSave }) {
  const places = [
    ...new Set(
      awards
        .filter((r) => r.drawingRequired)
        .flatMap((r) => r.eligiblePlacements.map((p) => p.place)),
    ),
  ].sort((a, b) => a - b);
  return (
    <form
      className="drawing-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() =>
          onSave(
            places.map((place) => ({
              place,
              playerId: f.get("place-" + place),
            })),
          ),
        );
      }}
    >
      <h3>Record the organizer’s drawing</h3>
      <p>
        Conduct the drawing outside the app. Then record one eligible winner for
        each affected place. This never runs a random draw or issues tickets.
      </p>
      {places.map((place) => (
        <label key={place}>
          Place {place} · {place === 1 ? 25 : place === 2 ? 15 : 10} tickets
          <select name={"place-" + place} required defaultValue="">
            <option disabled value="">
              Choose the drawn player
            </option>
            {awards
              .filter(
                (r) =>
                  r.drawingRequired &&
                  r.eligiblePlacements.some((p) => p.place === place),
              )
              .map((r) => (
                <option key={r.playerId} value={r.playerId}>
                  {r.display} · {r.points} points
                </option>
              ))}
          </select>
        </label>
      ))}
      <label className="consent">
        <input type="checkbox" required />
        <span>
          I conducted the organizer drawing and am recording its actual outcome.
        </span>
      </label>
      <button disabled={busy}>Record drawing results for review</button>
    </form>
  );
}
createRoot(document.getElementById("root")).render(<App />);
