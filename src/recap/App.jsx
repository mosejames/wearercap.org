import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  SITE, ROUNDS, CURRENT, HOUSES, UNSORTED, CLASSES, RELATIONS, WORDS,
  WORD_MAX, WORD_PROMPT, WORD_HINT, PROMPTS, randomPrompt,
  LINE_PROMPT, LINE_HINT, LINE_PLACEHOLDER, HOURS_URL, HASHTAGS,
  FIRST_SUMMER_CLASS, MULTI, wordLabel, houseById, roundBySlug,
} from './config.js';
import { listEntries, addEntry, uploadFile, setHidden } from './data.js';
import { makeZip } from './zip.js';

const LANES = [...HOUSES, UNSORTED, MULTI];

// Always render the closing date in school time, not the reader's timezone.
const CLOSE_LABEL = (iso) =>
  new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York',
  });

function useCountdown(iso) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return { over: true, text: 'Closed' };
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4), sec = Math.floor((ms % 6e4) / 1e3);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    over: false,
    urgent: ms < 864e5,
    text: d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${sec}s`,
    parts: [
      { label: 'days', value: pad(d) },
      { label: 'hrs', value: pad(h) },
      { label: 'min', value: pad(m) },
      { label: 'sec', value: pad(sec) },
    ],
  };
}

/* ----------------------------------------------------------------- tile */

// Short quotes get set big, long ones step down. Matches how the reference
// board reads — a few loud lines, the rest quieter.
function sizeClass(text) {
  const n = text.length;
  const longestWord = Math.max(...text.split(/\s+/).map((w) => w.length), 0);
  if (n <= 30 && longestWord <= 11) return 'xl';
  if (n <= 58 && longestWord <= 13) return 'lg';
  if (n <= 130) return 'md';
  return 'sm';
}

function Tile({ entry, mine, index = 0, onOpen }) {
  const lane = houseById(entry.house);
  const shot = entry.media?.[0];
  // Photos render at their true proportions (width:100% + height:auto), so they
  // are never stretched or cropped. The width/height attributes reserve the
  // right space before load; the masonry re-measures once images arrive.
  // Landscape shots occasionally span two columns for a varied collage.
  const ratio = shot && shot.w && shot.h ? shot.w / shot.h : null;
  const feature = !!shot && shot.kind !== 'video' && ratio && ratio >= 1.15 && (index * 7 + 3) % 5 === 0;

  const whoLabel = entry.parentName
    ? `${entry.parentName} · ${entry.child}’s ${entry.relation}`
    : `${entry.child}’s ${entry.relation}`;
  const by = (
    <p className="by">
      {whoLabel}
      <span> · Class of {entry.gradClass}</span>
      {entry.firstSummer && <span className="by-flag"> · First summer</span>}
    </p>
  );

  const quote = entry.story
    ? (entry.prompt ? `${entry.prompt} ${entry.story}` : entry.story)
    : '';

  if (shot) {
    return (
      <figure id={`entry-${entry.id}`} className={`card photo${feature ? ' feature' : ''}${mine ? ' mine' : ''}`}>
        {shot.kind === 'video'
          ? <video src={shot.url} controls playsInline preload="metadata" />
          : <img
              src={shot.url}
              alt="" loading="lazy" decoding="async"
              onClick={onOpen ? () => onOpen(entry) : undefined}
              width={shot.w || undefined} height={shot.h || undefined} />}
        <figcaption>
          {quote ? <p className="cap-story">{quote}</p> : null}
          {by}
        </figcaption>
      </figure>
    );
  }

  const text = quote || `${wordLabel(entry.word)}.`;
  return (
    <article id={`entry-${entry.id}`} className={`card said${lane.pale ? ' pale' : ''}${lane.flame ? ' flame' : ''}${mine ? ' mine' : ''}`}
             style={{ '--hc': lane.color, '--fg': lane.fg }}>
      <p className={`said-text ${sizeClass(text)}`}>{text}</p>
      <p className="by on-color">
        {whoLabel}
        <span> · {lane.name}</span>
      </p>
    </article>
  );
}

// The hero asks the question in giant type; this answers it. Words are sized by
// how many parents chose them, so the board's collective mood reads at a glance.
// Deliberately kept off the individual cards: a word is a vote, a story is a
// narrative, and stamping one on the other reads as a mismatch.
const WORDBAND_MAX = 14;

function WordBand({ words }) {
  const shown = words.slice(0, WORDBAND_MAX);
  if (shown.length === 0) return null;
  const top = shown[0].n;
  const floor = shown[shown.length - 1].n;
  const span = Math.max(1, top - floor);
  return (
    <section className="wordband">
      <div className="shell">
        <div className="wordband-head">
          <span className="eyebrow">What EXP felt like</span>
          <p>Every word below came from a parent who was there.</p>
        </div>
        <div className="wordband-list">
          {shown.map((w, i) => {
            const t = (w.n - floor) / span;            // 0 → smallest, 1 → biggest
            const size = Math.round(21 + t * 37);      // 21px … 58px
            return (
              <span key={w.id} className={`bigword${i === 0 ? ' lead' : ''}`}
                    style={{ '--s': size }}>
                {w.label}
                {w.n > 1 && <i>{w.n}</i>}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- form */

const EMPTY = { parentName: '', child: '', relation: '', gradClass: '', house: '', word: '', customWord: '', story: '', prompt: '' };

function useEntryForm(initial) {
  const [f, setF] = useState(() => ({ ...EMPTY, ...(initial || {}) }));
  const [media, setMedia] = useState([]);
  const [err, setErr] = useState('');
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const firstSummer = f.gradClass === FIRST_SUMMER_CLASS;
  const house = firstSummer ? UNSORTED.id : f.house;
  const word = f.customWord.trim() ? f.customWord.trim().toLowerCase() : f.word;
  const ready = Boolean(
    f.parentName.trim() && f.child.trim() && f.relation && f.gradClass && house && word
  );
  const missing = [f.parentName.trim(), f.child.trim(), f.relation, f.gradClass, house, word]
    .filter((v) => !v).length;
  const reset = () => { setF(EMPTY); setMedia([]); setErr(''); };
  return { f, set, media, setMedia, err, setErr, house, word, ready, missing, reset, firstSummer };
}

function EntryFields({ form }) {
  const { f, set, media, setMedia, err, setErr, firstSummer } = form;
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const pick = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setErr(''); setUploading(true);
    try {
      for (const file of files.slice(0, 10 - media.length)) {
        const m = await uploadFile(file);
        setMedia((x) => [...x, m]);
      }
    } catch (e2) {
      setErr(e2.message || 'That file would not upload. Try another?');
    } finally { setUploading(false); }
  }, [media.length, setErr, setMedia]);

  return (
    <>
      <div className="step">
        <label>Your first name</label>
        <input className="field" value={f.parentName} maxLength={40} autoComplete="off" placeholder="Charles"
               onChange={(e) => set('parentName')(e.target.value)} />
      </div>

      <div className="step">
        <label>Your student’s first name</label>
        <input className="field" value={f.child} maxLength={40} autoComplete="off" placeholder="Mose"
               onChange={(e) => set('child')(e.target.value)} />
        {f.parentName.trim() && f.child.trim() && f.relation && (
          <div className="note">
            You’ll show up as <b>{f.parentName.trim()} · {f.child.trim()}’s {f.relation}</b>.
          </div>
        )}
      </div>

      <div className="step">
        <label>You are their <span className="hint">tap one</span></label>
        <div className="chips">
          {RELATIONS.map((r) => (
            <button key={r} type="button" className={`chip${f.relation === r ? ' on' : ''}`}
                    onClick={() => set('relation')(r)}>{r}</button>
          ))}
        </div>
      </div>

      <div className="step">
        <label>Class of <span className="hint">your student’s graduating year</span></label>
        <div className="chips">
          {CLASSES.map((c) => (
            <button key={c} type="button" className={`chip${f.gradClass === c ? ' on' : ''}`}
                    onClick={() => { set('gradClass')(c); if (c === FIRST_SUMMER_CLASS) set('house')(''); }}>{c}</button>
          ))}
        </div>
      </div>

      <div className="step">
        <label>House</label>
        {firstSummer ? (
          <div className="note">
            Class of 2031 hasn’t been sorted yet — that happens after school starts. You get your own
            lane on the recap until then.
          </div>
        ) : (
          <div className="chips">
            {HOUSES.map((h) => (
              <button key={h.id} type="button" className={`chip${f.house === h.id ? ' on hc' : ''}`}
                      style={{ '--hc': h.color, '--fg': h.fg }} onClick={() => set('house')(h.id)}>{h.name}</button>
            ))}
            <button type="button" className={`chip${f.house === MULTI.id ? ' on hc flame' : ''}`}
                    style={{ '--hc': MULTI.color, '--fg': MULTI.fg }} onClick={() => set('house')(MULTI.id)}>{MULTI.pickLabel}</button>
          </div>
        )}
      </div>

      <div className="step">
        <label>{WORD_PROMPT} <span className="hint">{WORD_HINT}</span></label>
        <div className="chips">
          {WORDS.map((w) => (
            <button key={w.id} type="button"
                    className={`chip big${!f.customWord.trim() && f.word === w.id ? ' on' : ''}`}
                    onClick={() => { set('word')(w.id); set('customWord')(''); }}>{w.label}</button>
          ))}
        </div>
        <input className="field ownword" value={f.customWord} maxLength={WORD_MAX}
               placeholder="…or your own word"
               onChange={(e) => set('customWord')(e.target.value.replace(/\s+/g, ' '))} />
      </div>

      <div className="step">
        <label>{LINE_PROMPT} <span className="hint">{LINE_HINT}</span></label>
        <textarea className="field" value={f.story} placeholder={LINE_PLACEHOLDER}
                  onChange={(e) => set('story')(e.target.value.slice(0, 400))} />
        <div className="charc">{f.story.length}/400</div>
      </div>

      <div className="step">
        <label>Photos, video, selfies <span className="hint">straight off your camera roll — faces welcome</span></label>
        <div className="thumbs">
          {media.map((m, i) => (
            <div className="thumb" key={m.url}>
              {m.kind === 'video' ? <video src={m.url} muted /> : <img src={m.url} alt="" />}
              <button type="button" onClick={() => setMedia((x) => x.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          {media.length < 10 && (
            <button type="button" className="upl" disabled={uploading}
                    onClick={() => fileRef.current?.click()}>{uploading ? '…' : '+'}</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={pick} />
      </div>

      {err && <p className="err">{err}</p>}
    </>
  );
}


/* ------------------------------------------------------------- mad-libs */

function MadLib({ form }) {
  const { f, set, media, setMedia, err, setErr, firstSummer } = form;
  const [wordOpen, setWordOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const wordShown = f.customWord.trim() || (f.word ? wordLabel(f.word) : '');

  const pick = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setErr(''); setUploading(true);
    try {
      for (const file of files.slice(0, 10 - media.length)) {
        const m = await uploadFile(file);
        setMedia((x) => [...x, m]);
      }
    } catch (e2) { setErr(e2.message || 'That file would not upload.'); }
    finally { setUploading(false); }
  }, [media.length, setErr, setMedia]);

  const inputWidth = (v, min) => ({ width: `${Math.max(min, (v || '').length + 2)}ch` });

  // A blank in the story. Filled → highlighted word you can tap to change.
  // Empty → a dashed blank with a whispered hint.
  const Slot = ({ id, value, hint }) => (
    value && editing !== id ? (
      <button type="button" className="fill" onClick={() => setEditing(id)}>{value}</button>
    ) : (
      <button type="button" className={`ml-slot${editing === id ? ' active' : ''}`}
              onClick={() => setEditing(editing === id ? null : id)}>{hint}</button>
    )
  );
  const pickIt = (k, v, closeTo = null) => { set(k)(v); setEditing(closeTo); };

  return (
    <div className="ml">
      {/* the word is the hero */}
      <div className="ml-word">
        <svg className="doodle heart" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20c-5-4.5-8-7.4-8-10.6C4 6.6 6 5 8.2 5c1.5 0 2.9.8 3.8 2 .9-1.2 2.3-2 3.8-2C18 5 20 6.6 20 9.4c0 3.2-3 6.1-8 10.6z"
                fill="none" stroke="var(--magenta)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <svg className="doodle spark" viewBox="0 0 24 24" aria-hidden="true">
          <g stroke="var(--magenta)" strokeWidth="2" strokeLinecap="round">
            <path d="M4 20 L9 15" /><path d="M12 21 L13 14" /><path d="M20 20 L16 15" />
          </g>
        </svg>
        {wordShown && !wordOpen ? (
          <>
            <button type="button" className="ml-word-big" onClick={() => setWordOpen(true)}>
              {wordShown}
            </button>
            <p className="ml-word-sub">That’s my EXP in one word.</p>
            <button type="button" className="ml-tap" onClick={() => setWordOpen(true)}>tap to change</button>
          </>
        ) : (
          <>
            <p className="ml-word-sub">My EXP in one word:</p>
            <div className="ml-opts center">
              {WORDS.map((w) => (
                <button key={w.id} type="button"
                        className={`chip${!f.customWord.trim() && f.word === w.id ? ' on' : ''}`}
                        onClick={() => { set('word')(w.id); set('customWord')(''); setWordOpen(false); }}>
                  {w.label}
                </button>
              ))}
              <input className="ml-input" style={inputWidth(f.customWord, 10)} value={f.customWord}
                     maxLength={WORD_MAX} placeholder="your own…"
                     onChange={(e) => set('customWord')(e.target.value.replace(/\s+/g, ' '))}
                     onKeyDown={(e) => { if (e.key === 'Enter' && f.customWord.trim()) setWordOpen(false); }}
                     onBlur={() => { if (f.customWord.trim()) setWordOpen(false); }} />
            </div>
          </>
        )}
      </div>

      <svg className="ml-wave" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 3 Q 25 6 50 3 T 100 3" fill="none" stroke="rgba(26,22,19,.12)" strokeWidth="1" />
      </svg>

      {/* the story writes itself */}
      <div className="ml-sentence">
        <p>
          Hi, I’m{' '}
          <input className="ml2-input" style={inputWidth(f.parentName, 9)} value={f.parentName}
                 maxLength={40} placeholder="my name" autoComplete="off"
                 onChange={(e) => set('parentName')(e.target.value)} />
          .
        </p>
        <p>
          My student is{' '}
          <input className="ml2-input" style={inputWidth(f.child, 9)} value={f.child}
                 maxLength={40} placeholder="their name" autoComplete="off"
                 onChange={(e) => set('child')(e.target.value)} />
          .
        </p>
        <p className="ml-hint">More than one RCA kid? List them all.</p>
        <p>
          And I’m their <Slot id="relation" value={f.relation} hint="mom? dad?" />.
        </p>
        {editing === 'relation' && (
          <div className="chips slotchips">
            {RELATIONS.map((r) => (
              <button key={r} type="button" className={`chip${f.relation === r ? ' on' : ''}`}
                      onClick={() => pickIt('relation', r)}>{r}</button>
            ))}
          </div>
        )}
        <p>
          We rep Class of <Slot id="gradClass" value={f.gradClass} hint="20__" />
          {firstSummer ? (
            <span className="ml-note"> — house comes after sorting.</span>
          ) : f.gradClass ? (
            <>
              , House <Slot id="house" value={f.house ? houseById(f.house).name : ''} hint="which one?" />.
            </>
          ) : '.'}
        </p>
        {editing === 'gradClass' && (
          <div className="chips slotchips">
            {CLASSES.map((c) => (
              <button key={c} type="button" className={`chip${f.gradClass === c ? ' on' : ''}`}
                      onClick={() => { set('gradClass')(c); if (c === FIRST_SUMMER_CLASS) set('house')(''); setEditing(null); }}>
                {c}
              </button>
            ))}
          </div>
        )}
        {editing === 'house' && !firstSummer && (
          <div className="chips slotchips">
            {HOUSES.map((h) => (
              <button key={h.id} type="button" className={`chip${f.house === h.id ? ' on hc' : ''}`}
                      style={{ '--hc': h.color, '--fg': h.fg }}
                      onClick={() => pickIt('house', h.id)}>{h.name}</button>
            ))}
            <button type="button" className={`chip${f.house === MULTI.id ? ' on hc flame' : ''}`}
                    style={{ '--hc': MULTI.color, '--fg': MULTI.fg }}
                    onClick={() => pickIt('house', MULTI.id)}>{MULTI.pickLabel}</button>
          </div>
        )}
      </div>

      <div className="ml-promptbox">
        <div className="ml-steplab prompt">
          <label>{f.prompt}</label>
          <button type="button" className="ml-shuffle"
                  onClick={() => set('prompt')(randomPrompt(f.prompt))}>↻ another prompt</button>
        </div>
        <textarea className="ml2-story" value={f.story} rows={2}
                  placeholder="finish the sentence…"
                  onChange={(e) => set('story')(e.target.value.slice(0, 400))} />
        <span className="charc">{f.story.length}/400</span>
      </div>

      <div className="ml-proof">
        <p className="ml-prooflab">Proof it happened <span className="ml-opt">(optional)</span></p>
        <div className="ml-upload">
          {media.map((m, i) => (
            <div className="thumb" key={m.url}>
              {m.kind === 'video' ? <video src={m.url} muted /> : <img src={m.url} alt="" />}
              <button type="button" onClick={() => setMedia((x) => x.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          {media.length < 10 && (
            <>
              <button type="button" className="upl" disabled={uploading}
                      onClick={() => fileRef.current?.click()}>{uploading ? '…' : '+'}</button>
              {media.length === 0 && <span className="ml-uplhint">Add a photo, video, or selfie</span>}
            </>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={pick} />

      {err && <p className="err">{err}</p>}
    </div>
  );
}

// Parents who arrive from the email tap a word and land straight in the form,
// skipping the hero. This strip carries the two things they'd have seen there:
// proof other parents already showed up, and the closing clock.
function SheetProof({ count, faces, countdown }) {
  if (!count && !countdown) return null;
  return (
    <div className="proof">
      {faces.length > 0 && (
        <div className="proof-faces">
          {faces.map((m) => <img key={m.url} src={m.url} alt="" loading="lazy" />)}
        </div>
      )}
      <div className="proof-text">
        {count > 0 && (
          <p className="proof-count">
            You&rsquo;re joining <b>{count}</b> {count === 1 ? 'parent' : 'parents'} so far.
          </p>
        )}
        {countdown && !countdown.over && (
          <p className="proof-clock">
            Closes {CLOSE_LABEL(CURRENT.closesAt)} · <b>{countdown.text} left</b>
          </p>
        )}
      </div>
    </div>
  );
}

function Sheet({ initialWord = '', onClose, onDone, count = 0, faces = [], countdown = null }) {
  const form = useEntryForm({
    ...(initialWord ? { word: initialWord } : null),
    prompt: randomPrompt(),
  });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!form.ready || busy) return;
    setBusy(true); form.setErr('');
    try {
      onDone(await addEntry({ ...form.f, word: form.word, house: form.house }, form.media));
    } catch (e) { form.setErr(e.message || 'Something went wrong.'); setBusy(false); }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-head">
          <div className="grab" />
          <button type="button" className="sheet-x" onClick={onClose} aria-label="Close">×</button>
          <span className="eyebrow">Fill in the blanks</span>
          <h2>Finish the sentence.</h2>
        </div>
        <div className="sheet-body">
          <SheetProof count={count} faces={faces} countdown={countdown} />
          <MadLib form={form} />
        </div>
        <div className="sheet-foot stack">
          <button className="btn flame" onClick={submit} disabled={!form.ready || busy}>
            {busy ? 'Adding…'
              : form.ready ? 'Add to the recap'
              : `Fill ${form.missing} more blank${form.missing === 1 ? '' : 's'}`}
          </button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  );
}

function Done({ entry, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-body">
          <div className="done">
            <div className="mark-ok">✓</div>
            <h2>You’re in the recap.</h2>
            <p>Thank you, {entry.parentName || `${entry.child}’s ${entry.relation}`}. Close this and you’ll see yourself up there.</p>
          </div>
          <div className="next">
            <b>One more thing, and it takes 40 seconds</b>
            <p>Log the hours you worked this summer. It counts — but only if it’s logged.</p>
            <a className="btn flame" href={HOURS_URL} target="_blank" rel="noreferrer"
               style={{ display: 'inline-block', textDecoration: 'none' }}>Log my hours →</a>
          </div>
          <div className="next">
            <b>Know a parent who was there?</b>
            <p>This is only as full as we make it. Send them the link.</p>
            <button className="btn ghost" onClick={async () => {
              const url = window.location.origin + '/rcap-recap/';
              try {
                if (navigator.share) await navigator.share({ title: 'The RCAP Recap', url });
                else { await navigator.clipboard.writeText(url); setCopied(true); }
              } catch { /* dismissed */ }
            }}>{copied ? 'Link copied ✓' : 'Share the recap'}</button>
          </div>
        </div>
        <div className="sheet-foot">
          <button className="btn" style={{ width: '100%' }} onClick={onClose}>See the recap</button>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- admin */

const safeName = (s) => String(s || '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

function QuickAdd({ onAdded }) {
  const form = useEntryForm();
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  async function add() {
    if (!form.ready || busy) return;
    setBusy(true); form.setErr(''); setOk('');
    try {
      const e = await addEntry({ ...form.f, word: form.word, house: form.house }, form.media);
      setOk(`Added ${e.child}’s ${e.relation}. Form is clear — go again.`);
      form.reset(); onAdded();
    } catch (e) { form.setErr(e.message); }
    setBusy(false);
  }
  return (
    <div className="panel">
      <h3>Add on someone’s behalf</h3>
      <p className="sub">
        For seeding. Text a parent, get their word and their story, type it in here. The form clears
        itself after each one so you can run straight down your list.
      </p>
      <EntryFields form={form} />
      {ok && <p className="ok">{ok}</p>}
      <button className="btn flame" style={{ marginTop: 16 }} onClick={add} disabled={!form.ready || busy}>
        {busy ? 'Adding…' : 'Add this one'}
      </button>
    </div>
  );
}

function Admin({ rows, reload }) {
  const [pass, setPass] = useState('');
  const [open, setOpen] = useState(null);
  const [progress, setProgress] = useState('');
  const [err, setErr] = useState('');

  const stats = useMemo(() => ({
    total: rows.length,
    visible: rows.filter((r) => !r.hidden).length,
    media: rows.reduce((n, r) => n + (r.media?.length || 0), 0),
    stories: rows.filter((r) => r.story).length,
  }), [rows]);

  async function toggle(r) {
    setErr('');
    try { await setHidden(r.id, !r.hidden, pass); reload(); }
    catch (e) { setErr(e.message || 'Could not update.'); }
  }

  function downloadCSV() {
    const head = ['Name shown', 'Parent', 'Student', 'Relation', 'Class of', 'House', 'Word', 'Story', 'Photos', 'Media URLs', 'First summer', 'Hidden', 'Submitted'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(',')];
    for (const r of rows) {
      lines.push([
        r.parentName ? `${r.parentName} · ${r.child}'s ${r.relation}` : `${r.child}'s ${r.relation}`,
        r.parentName, r.child, r.relation, r.gradClass,
        houseById(r.house).name, wordLabel(r.word), r.story,
        r.media?.length || 0, (r.media || []).map((m) => m.url).join(' | '),
        r.firstSummer ? 'yes' : 'no', r.hidden ? 'yes' : 'no', r.createdAt,
      ].map(esc).join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rcap-recap-esp-2026.csv';
    a.click(); URL.revokeObjectURL(a.href);
  }

  async function downloadZIP() {
    setProgress('Preparing…');
    const enc = new TextEncoder();
    const files = [];
    const withMedia = rows.filter((r) => r.media?.length);
    const total = withMedia.reduce((n, r) => n + r.media.length, 0);
    let done = 0;

    for (const r of withMedia) {
      for (let i = 0; i < r.media.length; i++) {
        const m = r.media[i];
        setProgress(`Downloading ${done + 1} of ${total}…`);
        try {
          const buf = new Uint8Array(await (await fetch(m.url)).arrayBuffer());
          const ext = m.kind === 'video' ? (m.url.split('.').pop()?.split('?')[0] || 'mp4') : 'jpg';
          const n = r.media.length > 1 ? `-${i + 1}` : '';
          files.push({
            name: `RCAP-Recap-ESP-2026/${(r.createdAt || '').slice(0, 10)}_${safeName(r.child)}s-${safeName(r.relation)}_${safeName(houseById(r.house).name)}${n}.${ext}`,
            data: buf,
          });
        } catch { /* skip unreachable file */ }
        done++;
      }
    }

    const stories = rows.map((r) =>
      `${r.child}'s ${r.relation} — Class of ${r.gradClass} — ${houseById(r.house).name} — "${wordLabel(r.word)}"\n` +
      (r.story ? `   "${r.story}"\n` : '') + `   ${r.createdAt}\n`).join('\n');
    files.push({ name: 'RCAP-Recap-ESP-2026/_stories.txt', data: enc.encode(stories) });

    setProgress('Zipping…');
    const blob = makeZip(files);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'RCAP-Recap-ESP-2026.zip';
    a.click();
    URL.revokeObjectURL(a.href);
    setProgress('');
  }

  if (!open) {
    return (
      <div className="narrow" style={{ paddingTop: 90, maxWidth: 420 }}>
        <span className="eyebrow">RCAP · Recap back office</span>
        <h1 style={{ fontSize: 34, letterSpacing: '-.03em', margin: '16px 0 20px' }}>Back office</h1>
        <form onSubmit={(e) => { e.preventDefault(); setOpen(true); }}>
          <input className="field" type="password" value={pass} placeholder="Passcode"
                 onChange={(e) => setPass(e.target.value)} />
          <button className="btn flame" style={{ width: '100%', marginTop: 14 }}>Open</button>
        </form>
        <p className="sub" style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-soft)' }}>
          Downloads work without the passcode being right. Hiding an entry checks it in the database.
        </p>
      </div>
    );
  }

  return (
    <div className="shell" style={{ paddingTop: 50, paddingBottom: 80 }}>
      <span className="eyebrow">RCAP · Recap back office</span>
      <h1 style={{ fontSize: 38, letterSpacing: '-.035em', margin: '16px 0 6px' }}>
        {stats.total} stories · {stats.media} files
      </h1>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 22px' }}>
        {stats.visible} showing · {stats.stories} with a written story
      </p>
      <div className="hero-cta" style={{ margin: '0 0 30px' }}>
        <button className="btn flame" onClick={downloadZIP} disabled={!!progress}>
          {progress || 'Download all photos (ZIP)'}
        </button>
        <button className="btn ghost" onClick={downloadCSV}>Download stories (CSV)</button>
        <button className="btn ghost" onClick={reload}>Refresh</button>
      </div>
      {err && <p className="err">{err}</p>}
      <QuickAdd onAdded={reload} />
      <div className="grid">
        {rows.map((r, i) => (
          <div key={r.id} style={{ breakInside: 'avoid', opacity: r.hidden ? 0.4 : 1 }}>
            <Tile entry={r} index={i} />
            <button className="btn ghost" style={{ width: '100%', marginTop: -6, marginBottom: 18, padding: '9px 14px', fontSize: 13 }}
                    onClick={() => toggle(r)}>
              {r.hidden ? 'Show on the recap' : 'Hide from the recap'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ app */

// Tap a board photo to open it full-size over a dark backdrop. Shows the whole
// original image (never cropped), with the caption. Close on backdrop, ×, or Esc.
function Lightbox({ entry, onClose }) {
  const shot = entry.media?.[0];
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shot) return null;
  const whoLabel = entry.parentName
    ? `${entry.parentName} · ${entry.child}’s ${entry.relation}`
    : `${entry.child}’s ${entry.relation}`;
  const quote = entry.story
    ? (entry.prompt ? `${entry.prompt} ${entry.story}` : entry.story)
    : '';
  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="lightbox-x" onClick={onClose} aria-label="Close">×</button>
      <figure className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        {shot.kind === 'video'
          ? <video src={shot.url} controls playsInline autoPlay />
          : <img src={shot.url} alt="" />}
        <figcaption>
          {quote ? <p className="lightbox-story">{quote}</p> : null}
          <p className="lightbox-by">{whoLabel} · Class of {entry.gradClass}</p>
        </figcaption>
      </figure>
    </div>
  );
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [open, setOpen] = useState(null);
  const [done, setDone] = useState(null);
  const [mineId, setMineId] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [view, setView] = useState(CURRENT.slug);
  const countdown = useCountdown(CURRENT.closesAt);
  const [isAdmin, setIsAdmin] = useState(() =>
    typeof window !== 'undefined' && window.location.hash === '#admin');

  const reload = useCallback(async () => {
    try { setRows(await listEntries()); setLoadErr(''); }
    catch (e) { setLoadErr(e.message || 'Could not load the recap.'); }
    setLoaded(true);
  }, []);

  // Deep links from the email: /rcap-recap/?word=proud opens the sheet with
  // that word already picked. Unknown words just open the sheet.
  useEffect(() => {
    const w = (new URLSearchParams(window.location.search).get('word') || '').toLowerCase().trim();
    if (!w) return;
    if (new Date(CURRENT.closesAt).getTime() <= Date.now()) return;
    setOpen(WORDS.some((x) => x.id === w) ? w : '');
  }, []);

  useEffect(() => {
    reload();
    const onHash = () => setIsAdmin(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHash);
    const t = setInterval(reload, 20000);
    return () => { window.removeEventListener('hashchange', onHash); clearInterval(t); };
  }, [reload]);

  useEffect(() => { document.body.style.overflow = open !== null || done ? 'hidden' : ''; }, [open, done]);

  const visible = useMemo(
    () => rows.filter((r) => !r.hidden && (view === 'all' || r.round === view)),
    [rows, view]
  );
  const currentCount = useMemo(
    () => rows.filter((r) => !r.hidden && r.round === CURRENT.slug).length,
    [rows]
  );
  const pct = Math.min(100, Math.round((currentCount / CURRENT.goal) * 100));

  // A few recent faces to show inside the sheet as proof other parents showed up.
  const proofFaces = useMemo(() => {
    const out = [];
    for (const r of rows) {
      if (r.hidden || r.round !== CURRENT.slug) continue;
      const shot = r.media?.find((m) => m.kind !== 'video');
      if (shot) out.push(shot);
      if (out.length === 4) break;
    }
    return out;
  }, [rows]);

  const stats = useMemo(() => {
    const byHouse = {}, byWord = {};
    for (const e of visible) {
      byHouse[e.house] = (byHouse[e.house] || 0) + 1;
      byWord[e.word] = (byWord[e.word] || 0) + 1;
    }
    return {
      total: visible.length, byHouse,
      lead: Math.max(0, ...HOUSES.map((h) => byHouse[h.id] || 0)),
      words: Object.entries(byWord)
        .map(([id, n]) => ({ id, label: wordLabel(id), n }))
        .sort((a, b) => b.n - a.n),
      firstSummer: visible.filter((e) => e.firstSummer).length,
      photos: visible.reduce((n, e) => n + (e.media?.length || 0), 0),
    };
  }, [visible]);

  // Masonry: size each tile's grid row-span from its real height so photos keep
  // their true ratio and pack tight, with the two-column features mixed in.
  const boardRef = useRef(null);
  useLayoutEffect(() => {
    const grid = boardRef.current;
    if (!grid) return;
    const relayout = () => {
      const cs = getComputedStyle(grid);
      const rowH = parseFloat(cs.gridAutoRows) || 8;
      const gap = parseFloat(cs.rowGap) || 0;
      for (const card of grid.children) {
        card.style.gridRowEnd = 'auto';
        const h = card.getBoundingClientRect().height;
        card.style.gridRowEnd = `span ${Math.max(1, Math.ceil((h + gap) / (rowH + gap)))}`;
      }
    };
    relayout();
    const ro = new ResizeObserver(relayout);
    ro.observe(grid);
    window.addEventListener('resize', relayout);
    const media = grid.querySelectorAll('img, video');
    media.forEach((m) => {
      m.addEventListener('load', relayout);
      m.addEventListener('loadedmetadata', relayout);
    });
    const t = setTimeout(relayout, 400);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', relayout);
      media.forEach((m) => {
        m.removeEventListener('load', relayout);
        m.removeEventListener('loadedmetadata', relayout);
      });
      clearTimeout(t);
    };
  }, [visible, isAdmin]);

  if (isAdmin) return <Admin rows={rows} reload={reload} />;


  return (
    <>
      <div className="topbar">
        <div className="shell topbar-in">
          <div className="mark">RCA<span>P</span><small>RON CLARK ACADEMY PARENTS</small></div>
          <div className="topmeta">{SITE.meta.map((m) => <div key={m}>{m}</div>)}<div>{CURRENT.label}</div></div>
        </div>
      </div>

      <header className="hero">
        <div className="shell">
          <p className="kicker">{SITE.kicker}</p>
          <h1>{SITE.titleLead} <span className="flame">{SITE.titleGrad}</span></h1>
          <p className="intro">{SITE.intro}</p>
          {!countdown.over && (
            <div className="hero-words">
              <p className="hero-words-lead">{SITE.wordLead}</p>
              <div className="wchips">
                {WORDS.map((w) => (
                  <button key={w.id} className="wchip" onClick={() => setOpen(w.id)}>{w.label}</button>
                ))}
                <button className="wchip own" onClick={() => setOpen('')}>Your own word…</button>
              </div>
            </div>
          )}

          <div className="hero-cta">
            {countdown.over ? (
              <span className="count-note">{CURRENT.name} is closed — everything below stays up.</span>
            ) : (
              <div className={`vault${countdown.urgent ? ' vault-urgent' : ''}`}>
                <p className="vault-lead">
                  <span className="vault-dot" aria-hidden="true" />
                  The vault closes in
                </p>
                <div className="vault-clock" role="timer" aria-label={`${countdown.text} left to add yours`}>
                  {countdown.parts.map((p) => (
                    <div className="vault-seg" key={p.label}>
                      <span className="vault-num">{p.value}</span>
                      <span className="vault-lab">{p.label}</span>
                    </div>
                  ))}
                </div>
                <p className="vault-note">
                  Closes <b>{CLOSE_LABEL(CURRENT.closesAt)}</b> — record your word before it locks.
                </p>
              </div>
            )}
          </div>
          {!countdown.over && (
            <div className="hero-progress">
              <div className="bar"><i style={{ width: `${pct}%` }} /></div>
              <span>{currentCount} of {CURRENT.goal} this round · {stats.photos} photos</span>
            </div>
          )}
        </div>
      </header>

      <WordBand words={stats.words} />

      <main>
        <section className="board">
          <div className="shell">
            <div className="board-head">
              <span className="eyebrow">The board</span>
              {ROUNDS.length > 1 ? (
                <div className="rounds">
                  {ROUNDS.map((r) => (
                    <button key={r.slug} className={`rchip${view === r.slug ? ' on' : ''}`}
                            onClick={() => setView(r.slug)}>{r.name}</button>
                  ))}
                  <button className={`rchip${view === 'all' ? ' on' : ''}`}
                          onClick={() => setView('all')}>Everything</button>
                </div>
              ) : (
                <p>Everything parents have sent in so far.</p>
              )}
            </div>
            {loadErr ? <div className="empty">{loadErr}</div>
              : !loaded ? <div className="empty">Loading…</div>
              : visible.length === 0 ? <div className="empty">Nothing here yet. Be the first one up.</div>
              : (
                <div className="board-grid" ref={boardRef}>
                  {visible.map((e, i) => <Tile key={e.id} entry={e} index={i} mine={e.id === mineId} onOpen={setZoom} />)}
                </div>
              )}
          </div>
        </section>

        <section className="body">
          <div className="shell">
            <section className="houses">
              <div className="houses-head">
                <span className="eyebrow">Four houses. One RCAP.</span>
                <p>A little fuel for the fire — but every name here counts the same.</p>
              </div>
              <div className="house-grid">
                {LANES.map((h) => {
                  const n = stats.byHouse[h.id] || 0;
                  const lead = h.id !== UNSORTED.id && h.id !== MULTI.id && n > 0 && n === stats.lead;
                  return (
                    <div key={h.id} className={`house${h.pale ? ' pale' : ''}${lead ? ' lead' : ''}${n === 0 ? ' zero' : ''}`}
                         style={{ '--hc': h.color, '--fg': h.fg }}>
                      <span className="n">{n}</span><b>{h.name}</b><em>{h.meaning}</em>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="shell">
          <p>Every hour you gave this summer counts — but only if it’s logged.{' '}
            <a href={HOURS_URL} target="_blank" rel="noreferrer">Log your volunteer hours →</a></p>
          <p className="tags">{HASHTAGS.join(' · ')}</p>
          <p style={{ marginTop: 14 }}>Ron Clark Academy Parents · Students at the center, always.</p>
        </div>
      </footer>

      {!countdown.over && open === null && !done && (
        <div className="sticky">
          <button className="btn flame" onClick={() => setOpen('')}>Add yours →</button>
        </div>
      )}

      {open !== null && (
        <Sheet initialWord={open} onClose={() => setOpen(null)}
               count={currentCount} faces={proofFaces} countdown={countdown}
               onDone={(e) => { setOpen(null); setDone(e); setMineId(e.id); setRows((p) => [e, ...p]); }} />
      )}
      {done && <Done entry={done} onClose={() => {
        const id = done.id;
        setDone(null);
        reload();
        // Land them on their own card instead of making them hunt for it.
        setTimeout(() => {
          document.getElementById(`entry-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
      }} />}
      {zoom && <Lightbox entry={zoom} onClose={() => setZoom(null)} />}
    </>
  );
}
