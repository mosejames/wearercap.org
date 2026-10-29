import React, { useState, useEffect } from "react";
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
import { supabase, sendCode, verifyCode } from "../vault/auth.js";
import { request, preparePhoto } from "./api.js";
import "./style.css";
const HOUSES = ["Amistad", "Altruismo", "Isibindi", "Reveur"];
const GRADES = ["4th", "5th", "6th", "7th", "8th", "Other / alumni"];
function App() {
  const [session, setSession] = useState(null),
    [ready, setReady] = useState(false),
    [mode, setMode] = useState("children"),
    [data, setData] = useState(null),
    [tab, setTab] = useState("play"),
    [screen, setScreen] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [sound, setSound] = useState(false),
    [selected, setSelected] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setData(null);
    });
    return () => subscription.unsubscribe();
  }, []);
  const refresh = async () => {
    if (session) {
      const d = await request("get", { mode });
      setData(d);
      return d;
    }
  };
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [session, mode]);
  const run = async (fn) => {
    setError("");
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
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
        <a className="brand" href="/little-boo/">
          WE ARE <b>RCAP</b>
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
        <p className="intro">
          Tiny costumes. Familiar faces.
          <br />
          <strong>Big “wait, is that YOU?” energy.</strong>
        </p>
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
          Children’s individual leaderboard. Closing time and tie rules to be
          announced. Tickets awarded by the organizer after final review.
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
        {!ready ? (
          <div className="panel">Setting the stage…</div>
        ) : !session ? (
          <section className="welcome panel">
            <Ghost size={48} />
            <h2>Come on down, RCAP!</h2>
            <p>
              Sign in to meet the mystery boos, share a throwback and play for
              your house.
            </p>
            <button className="gold" onClick={() => setScreen("signin")}>
              Take your place <Sparkles size={18} />
            </button>
            <div className="rules-grid">
              <div>
                <b>5</b>
                <span>first unaided correct</span>
              </div>
              <div>
                <b>3</b>
                <span>later unaided correct</span>
              </div>
              <div>
                <b>1</b>
                <span>correct with help</span>
              </div>
            </div>
            <p className="fine">
              <Lock size={13} /> Phone sign-in protects game participation and
              photos. It verifies a phone, not school membership. This link may
              be forwarded. Never upload anyone else’s child.
            </p>
          </section>
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
                  setMode("children");
                  setSelected(null);
                }}
              >
                Little Boos <span>CHILDREN</span>
              </button>
              <button
                className={mode === "adults" ? "active" : ""}
                onClick={() => {
                  setMode("adults");
                  setSelected(null);
                }}
              >
                Ghosts of Halloweens Past <span>ADULT BONUS</span>
              </button>
            </div>
            {!data.me && (
              <section className="panel">
                <h2>Your name in lights</h2>
                <p>
                  Pick a public player name and the house and grade your points
                  will support.
                </p>
                <button className="gold" onClick={() => setScreen("profile")}>
                  Set up my player
                </button>
              </section>
            )}
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
                  {mode === "children" ? "LITTLE BOOS" : "GHOSTS"} IDENTIFIED
                </span>
                <b>
                  {correct}
                  <small>/ {eligible}</small>
                </b>
              </div>
              <button
                className="gold"
                onClick={() => setScreen(data.me ? "upload" : "profile")}
              >
                <Camera size={19} /> Add my{" "}
                {mode === "children" ? "child’s" : "childhood"} photo
              </button>
            </div>
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
                        ? "Recognize a little boo?"
                        : "Before they were the grown-ups…"}
                    </h2>
                  </div>
                  <span className="count">
                    {data.photos.length} on the board
                  </span>
                </div>
                {!data.photos.length ? (
                  <section className="empty panel">
                    <div className="empty-cards">
                      <Ghost />
                      <Camera />
                      <Ghost />
                    </div>
                    <h2>The first mystery could be yours.</h2>
                    <p>
                      One early Halloween photo. No crop required.
                      <br />
                      Your throwback joins the board as soon as you submit.
                    </p>
                    <button
                      className="gold"
                      onClick={() => setScreen(data.me ? "upload" : "profile")}
                    >
                      Start the show <Upload size={18} />
                    </button>
                    <p className="fine">
                      Try one of their first three Halloweens, or the earliest
                      photo you have.
                    </p>
                  </section>
                ) : (
                  <div className="cards">
                    {data.photos.map((p, i) => (
                      <button
                        key={p.id}
                        className={
                          "card " +
                          (p.submitted ? "flipped " : "") +
                          (p.correct ? "solved" : "")
                        }
                        onClick={() => {
                          setSelected(p.id);
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
                          <span>MYSTERY {String(i + 1).padStart(2, "0")}</span>
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
                <p className="help-line">
                  <HelpCircle size={17} />
                  {data.distinctChildren < 10
                    ? `A little help unlocks at 10 distinct children. ${data.distinctChildren} have joined so far.`
                    : "A little help is open. Choose it before committing your one guess."}
                </p>
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
              <button onClick={() => supabase.auth.signOut()}>Sign out</button>
            </div>
          </>
        )}
        <footer>
          <b>WE ARE RCAP</b>
          <span>A little mystery. A lot of community.</span>
          <p>
            Voluntary submissions. No public answer reveals. Photos post
            immediately and can be reported or removed.
          </p>
        </footer>
      </main>
      {screen && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setScreen(null);
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
              onClick={() => setScreen(null)}
              disabled={busy}
            >
              <X />
            </button>
            {screen === "signin" && (
              <SignIn run={run} busy={busy} onDone={() => setScreen(null)} />
            )}
            {screen === "profile" && (
              <Profile
                me={data?.me}
                run={run}
                busy={busy}
                onSave={async (b) => {
                  await request("profile", b);
                  await refresh();
                  setScreen(null);
                }}
              />
            )}
            {screen === "upload" && (
              <UploadForm
                mode={mode}
                run={run}
                busy={busy}
                me={data.me}
                onSave={async (b) => {
                  await request("upload", { ...b, mode });
                  await refresh();
                  setScreen(null);
                  setNotice(
                    "Your mystery is on the board. Let the guessing begin!",
                  );
                }}
              />
            )}
            {screen === "guess" && photo && (
              <Guess
                photo={photo}
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
function SignIn({ run, busy, onDone }) {
  const [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          if (sent) {
            await verifyCode(phone, code);
            onDone();
          } else {
            await sendCode(phone);
            setSent(true);
          }
        });
      }}
    >
      <Ghost size={40} />
      <h2>Your ticket to the show</h2>
      <p>
        Use your existing RCAP phone sign-in. Your phone number stays off the
        board.
      </p>
      <label>
        Mobile phone
        <input
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          disabled={sent}
        />
      </label>
      {sent && (
        <label>
          Six-digit code
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </label>
      )}
      <button className="gold" disabled={busy}>
        {sent ? "Enter the game" : "Text me a sign-in code"}
      </button>
      {sent && (
        <button
          type="button"
          className="text-button"
          onClick={() => setSent(false)}
        >
          Change phone / request another code
        </button>
      )}
      <p className="fine">
        By tapping, you request one sign-in text. This does not sign you up for
        game texts. Standard carrier rates may apply.
      </p>
    </form>
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
function UploadForm({ mode, run, busy, me, onSave }) {
  const [file, setFile] = useState(null),
    [preview, setPreview] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        run(async () => {
          if (!file) throw Error("Choose your Halloween photo first.");
          const image = await preparePhoto(file);
          await onSave({
            image,
            name: form.get("name"),
            aliases: String(form.get("aliases"))
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
            house: form.get("house"),
            grade: form.get("grade"),
            caption: "",
            consent: form.get("consent") === "on",
          });
        });
      }}
    >
      <span className="eyebrow">ADD A LITTLE MYSTERY</span>
      <h2>
        {mode === "children"
          ? "Your child. Their little-boo era."
          : "Your own Halloween throwback."}
      </h2>
      <p>
        One photo per person. Portrait or landscape is welcome. Try their first
        three Halloweens, or the earliest photo you have.
      </p>
      <label className="picker">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setPreview(URL.createObjectURL(f));
            }
          }}
        />
        {preview ? (
          <>
            <img src={preview} alt="Your selected upload" />
            <span>
              <Camera /> Change photo
            </span>
          </>
        ) : (
          <>
            <Camera size={35} />
            <strong>Pick a Halloween throwback</strong>
            <span>Phone library or camera · up to 25 MB</span>
          </>
        )}
      </label>
      {file && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setFile(null);
            setPreview("");
          }}
        >
          Remove selected photo
        </button>
      )}
      <label>
        Full name, kept private
        <input
          name="name"
          maxLength={80}
          minLength={2}
          required
          autoComplete="off"
          placeholder={
            mode === "children"
              ? "Your child’s first and last name"
              : "Your first and last name"
          }
        />
      </label>
      <label>
        Accepted nicknames and spelling variants
        <input
          name="aliases"
          maxLength={500}
          placeholder="Separate with commas. Include familiar first-name forms."
        />
      </label>
      <Affiliations me={me} />
      <label className="consent">
        <input type="checkbox" name="consent" required />
        <span>
          {mode === "children"
            ? "I am this child’s parent or legal guardian and have permission to share this photo."
            : "This is my own childhood photo and I have permission to share it."}{" "}
          I understand it posts immediately for signed-in players, can be copied
          by viewers, and can be reported or removed. I will not include other
          identifiable children without permission.
        </span>
      </label>
      <p className="fine">
        Names and aliases are used privately to check guesses. Photo metadata is
        removed. No photo is sent to AI.
      </p>
      <button className="gold" disabled={busy || !file}>
        Put my mystery on the board <Sparkles size={18} />
      </button>
    </form>
  );
}
function Guess({
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
          Your own mystery. No points for guessing your own child or submission.
        </p>
      ) : photo.submitted ? (
        <p className="message">
          {photo.correct
            ? `✓ Identified! You earned ${photo.points} points.`
            : "One guess was your shot. The answer stays a mystery for everyone else."}
        </p>
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
                  "Remove this photo from the game? Existing points on it will no longer count. This person cannot be resubmitted during this round.",
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
          <p>Correct guesses will bring this board to life.</p>
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
        Live standings are provisional. Closing time and tie rules are not
        finalized. Children’s prizes: 25 / 15 / 10 raffle tickets. No tickets
        are issued by this app.
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
          Parents share one early Halloween photo of their own child. Adults can
          share their own childhood photo in the separate bonus round.
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
          No scoring on your own child or submission. Tell us your children’s
          names in your profile so we can exclude them.
        </li>
        <li>
          Pick one house and grade to support. They lock after your first point.
          Points are per identified child, with one photo per child and
          duplicate names/photos rejected.
        </li>
      </ol>
      <h3>Privacy and fair play</h3>
      <p>
        Sign-in verifies a phone number, not school membership. The link can be
        forwarded. Photos post immediately without premoderation. Submit only
        what you are comfortable sharing with other signed-in players, who can
        take screenshots.
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
      <h3>Round settings</h3>
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
        After the deadline and tie rule are settled, freeze the standings for
        review. This does not issue tickets or change raffle records.
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
createRoot(document.getElementById("root")).render(<App />);
