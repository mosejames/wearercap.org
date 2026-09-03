import { useState, useEffect, useRef, useMemo } from 'react';
import { COMMITTEES, TRAITS, HOUSES, CLASS_YEARS, byId, rank, topMatches } from './data.js';
import { getToken, clearToken, saveQuiet, submit } from './api.js';

/* The flow, in order. `leadAsk` and `leadPick` are conditional: a parent who
   picked nothing never sees the first, and a parent who only wants to help
   never sees the second. That is the whole point of the sequence — the
   leadership material, which is the heaviest thing on the page, only exists for
   the people it applies to. */

const firstName = (n) => (n || '').trim().split(/\s+/)[0] || '';

export default function App() {
  const [step, setStep] = useState('welcome');
  const [stack, setStack] = useState([]);
  const [token] = useState(getToken);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [students, setStudents] = useState([{ name: '', year: '', house: '' }]);
  const [traits, setTraits] = useState([]);
  const [picks, setPicks] = useState([]);
  const [wantsLead, setWantsLead] = useState(null);
  const [leadWhy, setLeadWhy] = useState({});
  const [leadRole, setLeadRole] = useState({});
  const [leadFor, setLeadFor] = useState([]);
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);

  const fn = firstName(name);

  const go = (next) => {
    setErr('');
    setStack((s) => [...s, step]);
    setStep(next);
  };
  const back = () => {
    setErr('');
    setStack((s) => {
      if (!s.length) return s;
      setStep(s[s.length - 1]);
      return s.slice(0, -1);
    });
  };

  const ORDER = ['welcome', 'name', 'email', 'students', 'traits', 'discover', 'leadAsk', 'leadPick', 'phone', 'review', 'done'];
  const pct = Math.round(((ORDER.indexOf(step) + 1) / ORDER.length) * 100);

  const payload = () => ({
    name, email, phone,
    students: students.filter((s) => s.name.trim()),
    personality: traits,
    committees: picks,
    wants_to_lead: wantsLead === true,
    chair_picks: leadFor.map((id) => ({
      committee: id,
      role: leadRole[id] || 'Either is fine',
      why: leadWhy[id] || '',
    })),
  });

  const house = students.find((s) => s.house)?.house || '';

  /* ------------------------------------------------------------- screens */

  if (step === 'welcome') return (
    <Screen night onNight>
      <p className="said anim">There is more than one way to show up at RCA.</p>
      <h1 className="hero-title anim" style={{ animationDelay: '.05s' }}>
        Find your<br /><span className="flame">place</span>
      </h1>
      <p className="sub anim" style={{ animationDelay: '.12s' }}>
        Ten committees, and you do not need to understand all of them to start.
        Tell us a little about you and we will point you at the ones that fit.
      </p>
      <div className="row anim" style={{ animationDelay: '.18s' }}>
        <button className="btn solid" onClick={() => go('name')}>Let's go</button>
        <span className="hintline">Takes about three minutes</span>
      </div>
    </Screen>
  );

  if (step === 'name') return (
    <Ask
      night
      question={<>First things first.<br />What's your name?</>}
      value={name}
      onChange={setName}
      placeholder="Your name"
      onNext={() => (name.trim() ? go('email') : setErr('We need something to call you.'))}
      err={err}
      onBack={back}
      pct={pct}
    />
  );

  if (step === 'email') return (
    <Ask
      night
      question={<>Good to meet you, {fn}.<br />Best email for you?</>}
      hint="This is how the board gets back to you, and the only way you hear what happened with your picks."
      type="email"
      value={email}
      onChange={setEmail}
      placeholder="you@example.com"
      onNext={() => {
        if (!email.includes('@') || !email.trim()) return setErr('That address does not look right.');
        saveQuiet(token, { name, email, status: 'partial' });
        go('students');
      }}
      err={err}
      onBack={back}
      pct={pct}
    />
  );

  if (step === 'students') return (
    <Screen pct={pct} onBack={back}>
      <p className="eyebrow anim">Your family</p>
      <h2 className="q anim" style={{ animationDelay: '.04s' }}>Who are you showing up for, {fn}?</h2>
      <div className="anim" style={{ animationDelay: '.1s' }}>
        {students.map((s, i) => (
          <div className="kid" key={i}>
            <div className="kid-top">
              <span className="kid-n">{students.length > 1 ? `Student ${i + 1}` : 'Student'}</span>
              {students.length > 1 && (
                <button className="drop" onClick={() => setStudents(students.filter((_, j) => j !== i))}>Remove</button>
              )}
            </div>
            <div className="two">
              <input
                className="field" placeholder="Their name" value={s.name} autoFocus={i === 0}
                onChange={(e) => setStudents(students.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <select
                className="field" value={s.year}
                onChange={(e) => setStudents(students.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))}
              >
                <option value="">Class of</option>
                {CLASS_YEARS.map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div style={{ marginTop: 12 }}>
              <span className="lab">House</span>
              <div className="pills">
                {HOUSES.map((h) => (
                  <button
                    key={h}
                    className={'pill' + (s.house === h ? ' on' : '')}
                    onClick={() => setStudents(students.map((x, j) => (j === i ? { ...x, house: h } : x)))}
                  >{h}</button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {students.length < 4 && (
          <button className="addmore" onClick={() => setStudents([...students, { name: '', year: '', house: '' }])}>
            Add another student
          </button>
        )}
      </div>
      {err && <p className="err">{err}</p>}
      <div className="row anim" style={{ animationDelay: '.14s' }}>
        <button className="btn solid" onClick={() => {
          if (!students.some((s) => s.name.trim())) return setErr('Add at least one student.');
          saveQuiet(token, { name, email, students: students.filter((s) => s.name.trim()) });
          go('traits');
        }}>Continue</button>
      </div>
    </Screen>
  );

  if (step === 'traits') return (
    <Screen pct={pct} onBack={back}>
      <p className="eyebrow anim">No wrong answers</p>
      <h2 className="q anim" style={{ animationDelay: '.04s' }}>Alright {fn}. What sounds most like you?</h2>
      <p className="sub anim" style={{ animationDelay: '.08s' }}>Pick as many as fit. We will use it to sort the list, not to limit it.</p>
      <div className="tiles anim" style={{ animationDelay: '.12s' }}>
        {TRAITS.map((t) => (
          <button
            key={t.id}
            className={'tile' + (traits.includes(t.id) ? ' on' : '')}
            onClick={() => setTraits(traits.includes(t.id) ? traits.filter((x) => x !== t.id) : [...traits, t.id])}
          >{t.label}</button>
        ))}
      </div>
      <div className="row anim" style={{ animationDelay: '.16s' }}>
        <button className="btn solid" onClick={() => {
          saveQuiet(token, { personality: traits });
          go('discover');
        }}>{traits.length ? 'Show me the fits' : 'Just show me everything'}</button>
      </div>
    </Screen>
  );

  if (step === 'discover') return (
    <Discover
      fn={fn} traits={traits} picks={picks} setPicks={setPicks} pct={pct} onBack={back}
      onNext={() => {
        if (!picks.length) return setErr('Add at least one to your list.');
        saveQuiet(token, { committees: picks });
        go('leadAsk');
      }}
      err={err}
    />
  );

  if (step === 'leadAsk') return (
    <Screen pct={pct} onBack={back}>
      <p className="eyebrow anim">One more thing</p>
      <h2 className="q anim" style={{ animationDelay: '.04s' }}>You found {picks.length}, {fn}.</h2>
      <ul className="rlist anim" style={{ animationDelay: '.08s', marginTop: 22 }}>
        {picks.map((id) => {
          const c = byId(id);
          return <li key={id}><span className="dot" data-a={c.accent} />{c.name}</li>;
        })}
      </ul>
      <p className="sub anim" style={{ animationDelay: '.12s', marginTop: 26 }}>
        Want to do more than participate? Some of these need a parent willing to take the lead.
      </p>
      <div className="row anim" style={{ animationDelay: '.16s' }}>
        <button className="btn solid" onClick={() => {
          setWantsLead(true);
          saveQuiet(token, { wants_to_lead: true });
          go('leadPick');
        }}>I'd consider leading</button>
        <button className="btn ghost" onClick={() => {
          setWantsLead(false);
          setLeadFor([]);
          saveQuiet(token, { wants_to_lead: false });
          go('phone');
        }}>I'd rather just help</button>
      </div>
    </Screen>
  );

  if (step === 'leadPick') {
    const eligible = picks.map(byId).filter((c) => !c.noChair);
    return (
      <Screen pct={pct} onBack={back}>
        <p className="eyebrow anim">How chairs get picked</p>
        <h2 className="q anim" style={{ animationDelay: '.04s' }}>Every chair is filled fresh this year.</h2>
        <p className="sub anim" style={{ animationDelay: '.08s' }}>
          If you have chaired before, raise your hand again. Having done the work is real
          experience and we count it. It is not a claim on the seat. The board picks chairs
          from the parents who apply here, and chairs build their own teams.
        </p>
        {!eligible.length ? (
          <>
            <p className="sub anim" style={{ marginTop: 22 }}>
              Men of RCAP picks its own leadership, so there is no chair application for it.
              Add another committee to your list if you want to lead one.
            </p>
            <div className="row"><button className="btn solid" onClick={() => go('phone')}>Continue</button></div>
          </>
        ) : (
          <>
            <p className="lab anim" style={{ marginTop: 30 }}>Which of yours would you lead?</p>
            <div className="anim" style={{ animationDelay: '.12s' }}>
              {eligible.map((c) => {
                const on = leadFor.includes(c.id);
                return (
                  <div className="leadblock" key={c.id}>
                    <div className="kid-top">
                      <h3 className="cc-name">{c.name}</h3>
                      <button
                        className={'pill' + (on ? ' on' : '')}
                        onClick={() => setLeadFor(on ? leadFor.filter((x) => x !== c.id) : [...leadFor, c.id])}
                      >{on ? 'Yes' : 'Consider me'}</button>
                    </div>
                    {on && (
                      <>
                        <span className="lab" style={{ marginTop: 14 }}>Chair, co-chair, or either?</span>
                        <div className="pills">
                          {['Chair', 'Co-chair', 'Either is fine'].map((r) => (
                            <button
                              key={r}
                              className={'pill' + ((leadRole[c.id] || 'Either is fine') === r ? ' on' : '')}
                              onClick={() => setLeadRole({ ...leadRole, [c.id]: r })}
                            >{r}</button>
                          ))}
                        </div>
                        <span className="lab" style={{ marginTop: 14 }}>Why this one, and what would you bring?</span>
                        <textarea
                          className="field ta" placeholder="A few sentences is plenty."
                          value={leadWhy[c.id] || ''}
                          onChange={(e) => setLeadWhy({ ...leadWhy, [c.id]: e.target.value })}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="row">
              <button className="btn solid" onClick={() => {
                saveQuiet(token, {
                  chair_picks: leadFor.map((id) => ({
                    committee: id, role: leadRole[id] || 'Either is fine', why: leadWhy[id] || '',
                  })),
                });
                go('phone');
              }}>Continue</button>
            </div>
          </>
        )}
      </Screen>
    );
  }

  if (step === 'phone') return (
    <Ask
      question={<>Last thing, {fn}.<br />What's your phone?</>}
      hint="We text more than we email. That is the whole reason we ask."
      type="tel"
      value={phone}
      onChange={setPhone}
      placeholder="(404) 555-0123"
      nextLabel="Review"
      onNext={() => go('review')}
      onSkip={() => go('review')}
      err={err}
      onBack={back}
      pct={pct}
    />
  );

  if (step === 'review') return (
    <Screen pct={pct} onBack={back}>
      <p className="eyebrow anim">Almost done</p>
      <h2 className="q anim" style={{ animationDelay: '.04s' }}>Looks like we found your place.</h2>
      <div className="receipt anim" style={{ animationDelay: '.1s' }}>
        <h3>You</h3>
        <p className="who">
          {name}
          <small>{[house && `${house} parent`, email, phone].filter(Boolean).join('  ·  ')}</small>
        </p>
        <h3>Your list</h3>
        <ul className="rlist">
          {picks.map((id) => {
            const c = byId(id);
            return (
              <li key={id}>
                <span className="dot" data-a={c.accent} />{c.name}
                {leadFor.includes(id) && <span className="lead-tag">Would lead</span>}
              </li>
            );
          })}
        </ul>
        <button className="editbtn" onClick={() => setStep('discover')}>Change my list</button>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="row anim" style={{ animationDelay: '.14s' }}>
        <button className="btn flame" disabled={sending} onClick={async () => {
          setErr(''); setSending(true);
          try {
            await submit(token, payload());
            clearToken();
            go('done');
          } catch (e) {
            console.error(e);
            setErr('That did not go through. Try once more, or text the board and we will add you by hand.');
          } finally { setSending(false); }
        }}>{sending ? 'Sending' : "That's me — send it"}</button>
      </div>
    </Screen>
  );

  return (
    <Screen night onNight>
      <div className="done-mark anim" />
      <h2 className="q anim" style={{ animationDelay: '.05s' }}>You're in, {fn}.</h2>
      <p className="sub anim" style={{ animationDelay: '.1s' }}>
        You are down for {listify(picks.map((id) => byId(id).name))}.
        {leadFor.length ? ' We have your chair application too, and the board will be back to you either way.' : ''}
      </p>
      <p className="said anim" style={{ animationDelay: '.16s', marginTop: 26 }}>
        If you signed up, you will hear from us. That is the whole promise.
      </p>
      <p className="foot anim" style={{ animationDelay: '.2s' }}>
        Ron Clark Academy Parents · <a href="https://wearercap.org">wearercap.org</a>
      </p>
    </Screen>
  );
}

/* --------------------------------------------------------------- pieces */

function Screen({ children, night, onNight, pct, onBack, wide, big }) {
  return (
    <>
      {pct != null && <div className="progress"><i style={{ width: pct + '%' }} /></div>}
      <div className={'topbar' + (onNight ? ' on-night' : '')}>
        <span className="brand">We Are <span>RCAP</span></span>
        {onBack && <button className="backlink" onClick={onBack}>Back</button>}
      </div>
      <section className={'screen' + (night ? ' night' : '') + (wide ? ' wide' : '')}>
        <div className={'inner' + (big ? ' big' : '')}>{children}</div>
      </section>
    </>
  );
}

/* One field, one question, Enter to continue. */
function Ask({ question, hint, value, onChange, placeholder, type = 'text', onNext, onSkip, nextLabel = 'Continue', err, onBack, pct, night }) {
  const ref = useRef(null);
  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 380); return () => clearTimeout(t); }, []);
  return (
    <Screen night={night} onNight={night} pct={pct} onBack={onBack}>
      <h2 className="q anim">{question}</h2>
      {hint && <p className="sub anim" style={{ animationDelay: '.06s' }}>{hint}</p>}
      <input
        ref={ref} className="bigfield anim" style={{ animationDelay: '.1s' }}
        type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onNext(); } }}
      />
      {err && <p className="err">{err}</p>}
      <div className="row anim" style={{ animationDelay: '.14s' }}>
        <button className="btn solid" onClick={onNext}>{nextLabel}</button>
        {onSkip && <button className="btn ghost" onClick={onSkip}>Skip</button>}
        <span className="hintline">Press Enter</span>
      </div>
    </Screen>
  );
}

function Discover({ fn, traits, picks, setPicks, onNext, err, onBack, pct }) {
  const matches = useMemo(() => topMatches(traits), [traits]);
  const [tab, setTab] = useState(matches.length ? 'fit' : 'all');
  const [open, setOpen] = useState(null);
  const shown = tab === 'fit' ? matches : rank(traits);
  const toggle = (id) => setPicks(picks.includes(id) ? picks.filter((x) => x !== id) : [...picks, id]);

  /* Escape closes the lightbox and the page behind it stops scrolling while it
     is up. Both are what people expect of a modal, and neither is free. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const detail = open ? byId(open) : null;

  return (
    <Screen pct={pct} onBack={onBack} wide big>
      <div className="anim">
        <p className="eyebrow">Committee discovery</p>
        <h2 className="q">
          {matches.length
            ? <>{fn}, we found a few that feel like you.</>
            : <>Here they all are, {fn}.</>}
        </h2>
        <p className="sub">Adding one is not a commitment. It is a list you can change right up until you send it.</p>
      </div>

      {matches.length > 0 && (
        <div className="seg anim" style={{ animationDelay: '.06s' }}>
          <button className={tab === 'fit' ? 'on' : ''} onClick={() => setTab('fit')}>Your fits</button>
          <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>Explore all ten</button>
        </div>
      )}

      {/* The list itself, not a tally of it. Seeing the names accumulate is the
          reward for browsing, and each pill is its own undo. */}
      <div className="basket anim" style={{ animationDelay: '.08s' }}>
        <div className="basket-top">
          <span className="basket-l">{fn ? `${fn}'s list` : 'Your list'}</span>
          <button className="btn flame" onClick={onNext} disabled={!picks.length}>Done picking</button>
        </div>
        {picks.length ? (
          <div className="bpills">
            {picks.map((id) => {
              const c = byId(id);
              return (
                <button
                  className="bpill" data-a={c.accent} key={id}
                  onClick={() => toggle(id)} aria-label={'Remove ' + c.name}
                >{c.name}<i aria-hidden="true">&times;</i></button>
              );
            })}
          </div>
        ) : (
          <p className="bempty">Nothing yet. Tap Add on any card.</p>
        )}
      </div>

      {err && <p className="err" style={{ marginBottom: 14 }}>{err}</p>}

      <div className="grid anim" style={{ animationDelay: '.1s' }}>
        {shown.map((c) => {
          const on = picks.includes(c.id);
          return (
            <article className={'cc' + (on ? ' picked' : '')} data-a={c.accent} key={c.id}>
              <h3 className="cc-name">{c.name}</h3>
              <p className="cc-blurb">{c.blurb}</p>
              <div className="cc-acts">
                <button className={'add' + (on ? ' on' : '')} onClick={() => toggle(c.id)}>
                  {on ? 'Added' : 'Add to my list'}
                </button>
                <button className="det" onClick={() => setOpen(c.id)}>Details</button>
              </div>
            </article>
          );
        })}
      </div>

      {tab === 'fit' && (
        <div className="row">
          <button className="btn ghost" onClick={() => setTab('all')}>Explore all ten</button>
        </div>
      )}

      {detail && (
        <div className="lb" onClick={() => setOpen(null)}>
          <div
            className="lb-in" data-a={detail.accent} role="dialog" aria-modal="true"
            aria-label={detail.name} onClick={(e) => e.stopPropagation()}
          >
            <h3 className="lb-name">{detail.name}</h3>
            <p className="lb-what">{detail.what}</p>
            <h4 className="lb-h">What you'll do</h4>
            <ul className="lb-list">{detail.does.map((d) => <li key={d}>{d}</li>)}</ul>
            {/* Acting on the list closes the box: reading Details is a detour, and
                once you have decided you want to be back in the grid, not
                dismissing a panel you are finished with. Because the button now
                closes, an "Added" badge that quietly removed on tap would be a
                trap, so the label says what the tap will actually do. */}
            <div className="lb-actions">
              <button
                className={'add lb-add' + (picks.includes(detail.id) ? ' on' : '')}
                onClick={() => { toggle(detail.id); setOpen(null); }}
              >{picks.includes(detail.id) ? 'Remove from my list' : 'Add to my list'}</button>
              <button className="lb-x" onClick={() => setOpen(null)} aria-label="Close">&times;</button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

function listify(a) {
  if (!a.length) return 'nothing yet';
  if (a.length === 1) return a[0];
  if (a.length === 2) return a[0] + ' and ' + a[1];
  return a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1];
}
