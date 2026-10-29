import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  Ghost,
  Check,
  ChevronLeft,
  Lock,
  Sparkles,
  Upload,
} from "lucide-react";
import { sendCode, verifyCode } from "../vault/auth.js";
import { preparePhoto } from "./api.js";
import { splitNames } from "./journey.js";
export const HOUSES = ["Amistad", "Altruismo", "Isibindi", "Reveur"];
export const GRADES = ["4th", "5th", "6th", "7th", "8th", "Other / alumni"];
const blank = {
  file: null,
  image: "",
  name: "",
  aliases: "",
  house: "",
  grade: "",
  consent: false,
  mode: "children",
  processing: false,
  error: "",
};
export function usePhotoDraft() {
  const [draft, setDraft] = useState(blank),
    sequence = useRef(0);
  const choose = async (file) => {
    if (!file) return;
    const current = ++sequence.current;
    setDraft((d) => ({ ...d, file, image: "", processing: true, error: "" }));
    try {
      const image = await preparePhoto(file);
      if (sequence.current === current)
        setDraft((d) => ({ ...d, image, processing: false }));
    } catch (e) {
      if (sequence.current === current)
        setDraft((d) => ({ ...d, processing: false, error: e.message }));
    }
  };
  const remove = () => {
    sequence.current++;
    setDraft((d) => ({
      ...d,
      file: null,
      image: "",
      processing: false,
      error: "",
    }));
  };
  const clear = () => {
    sequence.current++;
    setDraft(blank);
  };
  useEffect(() => {
    if (!draft.file) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft.file]);
  return { draft, setDraft, choose, remove, clear };
}
export function PhotoPreview({ draft, small = false }) {
  return draft.image ? (
    <img
      className={small ? "draft-thumbnail" : "draft-preview"}
      src={"data:image/jpeg;base64," + draft.image}
      alt="Your selected Halloween photo"
    />
  ) : draft.processing ? (
    <div className="photo-preparing" role="status">
      <Camera />
      <span>Getting your photo ready…</span>
    </div>
  ) : null;
}
export function UploadFlow({
  draft,
  setDraft,
  choose,
  remove,
  mode,
  session,
  ready,
  loaded,
  me,
  lostPhoto,
  onSignIn,
  onSave,
  onRetry,
  canUpload,
  openingLabel,
  onLeave,
  busy,
  run,
}) {
  const [showAliases, setShowAliases] = useState(!!draft.aliases);
  const update = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const isChild = mode === "children";
  if (canUpload === null)
    return (
      <div>
        <p role="status">
          Loading the submission schedule. Your photo stays in this tab.
        </p>
        <button onClick={onLeave}>Back to the game</button>
      </div>
    );
  if (!canUpload)
    return (
      <div>
        <h2>Photo submissions have closed.</h2>
        <p>
          Your selected photo has not been posted. Guessing opens {openingLabel}
          .
        </p>
        {draft.image && <PhotoPreview draft={draft} />}
        <button className="gold" onClick={onLeave}>
          See opening time
        </button>
      </div>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!session) {
          onSignIn();
          return;
        }
        run(() =>
          onSave({
            image: draft.image,
            name: draft.name,
            aliases: splitNames(draft.aliases),
            house: draft.house || me?.house,
            grade: draft.grade || me?.grade,
            caption: "",
            consent: draft.consent,
          }),
        );
      }}
    >
      <span className="eyebrow">
        {!draft.file
          ? "1 · PICK A PHOTO"
          : !session
            ? "2 · KEEP YOUR PHOTO, SIGN IN"
            : "3 · ADD YOUR KID"}
      </span>
      <h2>{isChild ? "Add your kid." : "Add your childhood photo."}</h2>
      {!draft.file && (
        <p>
          One photo per student, siblings welcome. Portrait or landscape, no
          crop needed.
        </p>
      )}
      {lostPhoto && !draft.file && (
        <p className="draft-warning" role="status">
          Your tab restarted. For privacy, the photo wasn’t saved. Please choose
          it again; nothing was posted.
        </p>
      )}
      <label
        className={
          "picker " +
          (draft.file ? "has-photo" : "") +
          (session ? " signed-in" : "")
        }
      >
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            choose(file);
          }}
        />
        {draft.file ? (
          <>
            <PhotoPreview draft={draft} />
            <span>
              <Camera size={16} />
              {draft.processing ? "Choose a different photo" : "Change photo"}
            </span>
          </>
        ) : (
          <>
            <Camera size={35} />
            <strong>Choose a Halloween photo</strong>
            <span>From Photos, albums or files · up to 25 MB</span>
          </>
        )}
      </label>
      {draft.error && (
        <p className="draft-warning" role="alert">
          {draft.error}
        </p>
      )}
      {draft.file && (
        <button
          type="button"
          className="text-button"
          onClick={remove}
          disabled={busy}
        >
          Remove selected photo
        </button>
      )}
      {!draft.file && (
        <div className="photo-finding">
          <b>Looking for an old photo?</b>
          <p>
            Open your phone’s Photos app and search “Halloween”, a year or the
            costume. Favorite the photo, then return here and look in Favorites
            or the available albums. Your phone controls which albums appear.
          </p>
          <span>
            We can only see the photo you choose. This website can’t search your
            library.
          </span>
        </div>
      )}
      {draft.file && !session && (
        <>
          <p className="local-only">
            <Lock size={15} /> Nothing uploaded yet. Your photo stays in this
            tab through sign-in.
          </p>
          <button
            className="gold"
            disabled={!ready || busy || draft.processing || !draft.image}
          >
            Keep this photo &amp; sign in{" "}
            <ChevronLeft className="forward" size={17} />
          </button>
          <p className="fine">
            Closing this dialog keeps your selection. Refreshing or closing the
            tab requires choosing the photo again. No photo is saved in browser
            storage.
          </p>
        </>
      )}
      {session && !loaded && draft.file && (
        <div className="account-loading">
          <p role="status">Loading your sign-in. Your photo is still here…</p>
          <button type="button" disabled={busy} onClick={() => run(onRetry)}>
            Retry loading your account
          </button>
        </div>
      )}
      {session && loaded && draft.image && (
        <>
          <div className="local-only">
            <Check size={15} /> Photo ready. Just a few details, then it’s on
            the board.
          </div>
          <label>
            {isChild ? "Your child’s full name" : "Your full name"}
            <span className="field-note">Private. Used to check guesses.</span>
            <input
              name="name"
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
              required
              minLength={2}
              maxLength={80}
              autoComplete="off"
              placeholder="First and last name"
            />
          </label>
          {showAliases ? (
            <label>
              Nicknames or familiar first-name forms
              <span className="field-note">
                Optional. Separate with commas so friends’ guesses count.
              </span>
              <input
                name="aliases"
                maxLength={500}
                value={draft.aliases}
                onChange={(e) => update("aliases", e.target.value)}
                placeholder="Nickname, first name, spelling variant"
              />
            </label>
          ) : (
            <button
              className="text-button optional-field"
              type="button"
              onClick={() => setShowAliases(true)}
            >
              + Add a nickname or spelling variant (optional)
            </button>
          )}
          <div className="two-fields">
            <label>
              {isChild ? "Their house" : "House"}
              <select
                name="house"
                value={draft.house || me?.house || ""}
                onChange={(e) => update("house", e.target.value)}
                required
              >
                <option value="" disabled>
                  Choose house
                </option>
                {HOUSES.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </label>
            <label>
              {isChild ? "Their grade / class" : "Grade / class"}
              <select
                name="grade"
                value={draft.grade || me?.grade || ""}
                onChange={(e) => update("grade", e.target.value)}
                required
              >
                <option value="" disabled>
                  Choose grade
                </option>
                {GRADES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
          </div>
          {me && (
            <p className="fine">
              Your contribution points support {me.house}, {me.grade}, your
              existing scoring team. This student’s house and grade may be
              different.
            </p>
          )}
          {!me && (
            <p className="fine">
              Your points will support this house and grade. No parent name
              needed. Your first accepted student photo earns 3 points and locks
              this scoring team. Siblings’ bonuses support this same team.
            </p>
          )}
          <label className="consent">
            <input
              type="checkbox"
              name="consent"
              checked={draft.consent}
              onChange={(e) => update("consent", e.target.checked)}
              required
            />
            <span>
              {isChild
                ? "I am this child’s parent or guardian and have permission to share this photo."
                : "This is my own childhood photo and I have permission to share it."}{" "}
              It is accepted immediately. Other signed-in players can see and
              copy it when guessing opens. I have permission for anyone else
              pictured. I can remove it or report a concern.
            </span>
          </label>
          <button className="gold" disabled={busy || draft.processing}>
            {busy ? "Adding your kid…" : "Add to the board"}{" "}
            <Sparkles size={17} />
          </button>
          <p className="fine">
            Names stay private. Photo metadata is removed. No photo is sent to
            AI.{" "}
            {isChild
              ? "Earn 3 contribution points for each student’s first accepted photo. No extra points for replacement or retry."
              : "Adult uploads do not earn the student contribution bonus."}
          </p>
        </>
      )}
    </form>
  );
}
export function SignIn({
  run,
  busy,
  onDone,
  auth,
  setAuth,
  onBack,
  draft,
  intent,
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const wait = Math.max(
    0,
    Math.ceil(((auth.sentAt || 0) + 60000 - now) / 1000),
  );
  const update = (key, value) => setAuth((a) => ({ ...a, [key]: value }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          if (auth.sent) {
            await verifyCode(auth.phone, auth.code);
            await onDone();
          } else {
            await sendCode(auth.phone);
            setAuth((a) => ({ ...a, sent: true, sentAt: Date.now() }));
            setNow(Date.now());
          }
        });
      }}
    >
      <button
        type="button"
        className="text-button back-button"
        onClick={onBack}
        disabled={busy}
      >
        <ChevronLeft size={16} />
        {intent === "upload"
          ? "Back to your photo"
          : intent === "notice"
            ? "Back to opening time"
            : "Back to the game"}
      </button>
      <span className="eyebrow">
        {intent === "upload"
          ? "YOUR PHOTO IS STILL HERE"
          : intent === "notice"
            ? "ONE OPTIONAL OPENING TEXT"
            : intent === "standings"
              ? "THE GAME STANDINGS"
              : "GUESS A KID · EARN POINTS"}
      </span>
      <h2>
        {intent === "upload"
          ? "Sign in. Then add your kid."
          : intent === "notice"
            ? "Sign in to save your text request."
            : intent === "standings"
              ? "Sign in to see the standings."
              : "Sign in to see the kids."}
      </h2>
      {intent === "upload" && draft.image && (
        <div className="signin-photo">
          <PhotoPreview draft={draft} small />
          <p>
            Selected on your phone.
            <br />
            <b>Not uploaded or posted.</b>
          </p>
        </div>
      )}
      <p>
        Your phone keeps guesses and points linked to you. It stays off the
        board.
      </p>
      <label>
        Mobile phone
        <input
          type="tel"
          autoComplete="tel"
          value={auth.phone}
          onChange={(e) => update("phone", e.target.value)}
          required
          disabled={auth.sent}
        />
      </label>
      {auth.sent && (
        <label>
          Six-digit code
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            value={auth.code}
            onChange={(e) => update("code", e.target.value)}
            required
          />
        </label>
      )}
      <button className="gold" disabled={busy || (!auth.sent && wait > 0)}>
        {busy
          ? auth.sent
            ? "Verifying…"
            : "Sending your code…"
          : auth.sent
            ? "Verify & continue"
            : wait > 0
              ? `Request another code in ${wait}s`
              : "Text me a sign-in code"}
      </button>
      {auth.sent ? (
        <button
          type="button"
          className="text-button"
          onClick={() => setAuth((a) => ({ ...a, sent: false, code: "" }))}
          disabled={busy}
        >
          Change phone or request another code
        </button>
      ) : (
        <button
          type="button"
          className="text-button"
          onClick={() => update("sent", true)}
          disabled={busy}
        >
          I already have a code
        </button>
      )}
      <p className="fine">
        One sign-in text when you tap. No game texts or invitations. Standard
        carrier rates may apply. If this tab restarts, re-enter your phone and
        choose “I already have a code”.
      </p>
    </form>
  );
}
export function QuickScoring({ me, busy, run, onSave, mode }) {
  return (
    <form
      className="quick-scoring"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() =>
          onSave({
            house: f.get("house"),
            grade: f.get("grade"),
            ownNames: splitNames(f.get("ownNames")),
          }),
        );
      }}
    >
      <h3>Where should your points go?</h3>
      <p>One quick choice before your first guess. No parent name needed.</p>
      <div className="two-fields">
        <label>
          House
          <select name="house" defaultValue={me?.house || ""} required>
            <option value="" disabled>
              Choose house
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
              Choose grade
            </option>
            {GRADES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Your children’s full names, if any
        <span className="field-note">
          Private. We exclude your own children. Separate with commas.
        </span>
        <input
          name="ownNames"
          maxLength={500}
          autoComplete="off"
          placeholder="First and last names"
        />
      </label>
      <p className="fine">
        Choose one house and grade for your points, even with multiple children.
        They lock after your first point. You can edit your optional leaderboard
        name later.
      </p>
      <button className="gold" disabled={busy}>
        Continue to this guess <Ghost size={17} />
      </button>
    </form>
  );
}
