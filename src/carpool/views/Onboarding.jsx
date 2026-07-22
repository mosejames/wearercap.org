import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { stashPendingFamily, readPendingFamily, clearPendingFamily } from '../pendingFamily.js';
import { GOOGLE_CLIENT_ID, loadGoogleIdentity, createGoogleNonce } from '../googleIdentity.js';
import FamilyForm from './FamilyForm.jsx';

// Supabase's verifyOtp failure message is "Token has expired or is
// invalid". Map that specific case to language a parent will actually
// understand; every other error passes through unchanged.
function mapVerifyError(message) {
  const msg = message ?? '';
  if (/token/i.test(msg) && /expired|invalid/i.test(msg)) {
    return "That code didn't work. Check the digits, or send a new code.";
  }
  return msg || 'That code did not work. Please check it and try again.';
}

// Supabase surfaces raw operational language for send failures ("email rate
// limit exceeded", "For security purposes, you can only request this once
// every 60 seconds"). A parent reads those as "the site is broken" or, worse,
// "I did something wrong". Translate the two we can actually hit; anything
// else passes through.
function mapSendError(message) {
  const msg = message ?? '';
  if (/rate limit/i.test(msg)) {
    return 'We are sending a lot of codes right now. Please wait a minute and try again.';
  }
  if (/once every|security purposes/i.test(msg)) {
    return 'A code was just sent. Please wait about a minute before asking for another.';
  }
  return msg || 'We could not send your code. Please try again.';
}

// The Google provider is not configured in Supabase yet, so the failure a
// parent will actually hit is the provider being off, which GoTrue words as
// "Unsupported provider: provider is not enabled". Read literally that tells a
// parent the site is broken, when in fact the email path directly underneath
// the button works perfectly. Point them at it.
//
// Unlike mapSendError, nothing passes through raw. A send error can be
// actionable ("wait a minute"); a refusal from /authorize never is. Whatever
// the reason, the parent's only move is the email option, so say that and keep
// GoTrue's operational language off the screen.
function mapOAuthError(message) {
  if (/provider is not enabled|unsupported provider|provider.*disabled/i.test(message ?? '')) {
    return 'Google sign in is not available yet. Please use the email option below.';
  }
  return 'We could not open Google just now. Please use the email option below.';
}

// Converts a stashed onboarding payload (the shape FamilyForm's
// onSubmitData hands us: { parentName, childNames, place, areaGeocode,
// direction, weekdays, contactPhone, contactEmail }) into the family-record
// shape FamilyForm's `family` prop expects, so "Use a different email" can
// re-render the form pre-filled instead of blank.
function stashToFormShape(p) {
  return {
    parent_name: p.parentName,
    child_names: p.childNames,
    address: p.place.formattedAddress,
    lat: p.place.lat,
    lng: p.place.lng,
    area_label: p.place.postalCode,   // FamilyForm reads selectedPlaceRef.postalCode from area_label
    direction: p.direction,
    weekdays: p.weekdays,
    contact_phone: p.contactPhone,
    contact_email: p.contactEmail,
  };
}

// Asks GoTrue's /authorize whether it will actually serve this provider,
// WITHOUT sending the parent there. Returns the provider's own error text if
// the answer is no, or null to mean "go ahead" (see the long note on
// handleGoogle for why this exists and why it fails open).
//
// redirect:'manual' is the whole trick: a healthy provider answers with a 302
// toward Google, which the browser hands back as an unreadable opaqueredirect
// instead of following, so probing costs one request and never touches Google.
// A refusal is a plain 400 with a readable JSON body, because GoTrue sends
// permissive CORS headers. Every other outcome returns null on purpose.
async function describeProviderFailure(authorizeUrl) {
  let res;
  try {
    res = await fetch(authorizeUrl, { method: 'GET', redirect: 'manual' });
  } catch {
    return null; // probe could not run; let the real redirect try
  }
  // opaqueredirect (type 'opaqueredirect', status 0) is the healthy answer.
  if (res.type === 'opaqueredirect' || res.status === 0 || res.status < 400) return null;
  try {
    const body = await res.json();
    return body?.msg || body?.error_description || body?.error || 'unavailable';
  } catch {
    return 'unavailable';
  }
}

// The Google "G", drawn inline. No network fetch, no external file: this has
// to render on a school parking lot with one bar of signal, and a missing
// image next to the label would read as a broken button.
function GoogleMark() {
  return (
    <svg className="cp-gmark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

// The Google option, in one self-contained piece so the two signed-out steps
// cannot ever disagree about which path they are on.
//
// TWO PATHS, ONE BUTTON'S WORTH OF SPACE.
//
// Primary is Google Identity Services: we get the ID token in the browser and
// hand it to Supabase, so Google's own screen names wearercap.org instead of
// the project's supabase.co host. Google renders that button itself, inside an
// iframe, which is why nothing here tries to restyle it beyond width. Fighting
// an iframe you do not control ends with a button that looks wrong or does not
// work, and this is the control the whole screen depends on.
//
// Fallback is the original signInWithOAuth redirect, unchanged. It is not a
// nicety. Branding is the thing we would like; a working way in is the thing a
// parent came for. Anything that stops GIS from putting a real, tappable button
// on the screen drops us to the redirect button instead:
//
//   1. VITE_GOOGLE_CLIENT_ID missing or empty (most likely a build that never
//      got the var). Decided synchronously, so no script is ever requested.
//   2. The gsi/client script fails to load, or hangs (8s timeout in
//      loadGoogleIdentity, because a hung request never fires onerror).
//   3. It loads but window.google.accounts.id is not there.
//   4. initialize or renderButton throws, or Web Crypto is unavailable so the
//      nonce cannot be built.
//   5. THE SILENT ONE: GIS loads, initialize and renderButton both return
//      without complaint, and the container stays empty. That is what an
//      unauthorized JavaScript origin looks like from the page's side, and it
//      is the failure most likely to reach production, because it depends on
//      Google Cloud config rather than on any code here. Nothing throws, so we
//      watch the container instead and only call the path healthy once a child
//      element with real height is in it.
//   6. The credential comes back but signInWithIdToken rejects it.
//
// Cases 1 to 5 swap the button before the parent ever touches it. Case 6 is
// the only one they see happen, so it says so and leaves them the button.
function GoogleSignIn() {
  const mountedRef = useRef(true);
  const buttonRef = useRef(null);
  const nonceRef = useRef('');

  // 'probing'  GIS is being set up; the container is on screen but empty.
  // 'gis'      Google's own button is rendered and measured.
  // 'fallback' our redirect button.
  const [path, setPath] = useState(GOOGLE_CLIENT_ID ? 'probing' : 'fallback');
  const [googleStatus, setGoogleStatus] = useState('idle'); // idle | redirecting | verifying
  const [googleError, setGoogleError] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Google hands the credential straight to this. Declared as a function so it
  // is hoisted above the effect that registers it.
  async function handleCredential(response) {
    if (!mountedRef.current) return;
    setGoogleError('');
    setGoogleStatus('verifying');
    try {
      // The unhashed nonce goes here; Google got the hashed one. Same auth
      // event as the redirect path, same freshly minted JWT, so App.jsx's
      // withClockSkewRetry still covers the "issued at future" case.
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response?.credential,
        nonce: nonceRef.current,
      });
      if (!mountedRef.current) return;
      if (error) {
        setGoogleStatus('idle');
        setPath('fallback');
        setGoogleError('We could not finish signing you in with Google. Please try the button above, or use your email below.');
        return;
      }
      // Success: onAuthStateChange in App.jsx re-renders into the signed-in
      // view. Nothing else to do here.
    } catch (err) {
      if (!mountedRef.current) return;
      setGoogleStatus('idle');
      setPath('fallback');
      setGoogleError('We could not finish signing you in with Google. Please try the button above, or use your email below.');
      console.warn('[carpool] signInWithIdToken threw', err);
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.info('[carpool] Google sign in path: fallback (no VITE_GOOGLE_CLIENT_ID)');
      return undefined;
    }
    let cancelled = false;
    let pollTimer = null;
    const toFallback = (reason) => {
      if (cancelled || !mountedRef.current) return;
      console.info('[carpool] Google sign in path: fallback (%s)', reason);
      setPath('fallback');
    };

    (async () => {
      try {
        const [gis, { nonce, hashedNonce }] = await Promise.all([
          loadGoogleIdentity(),
          createGoogleNonce(),
        ]);
        if (cancelled || !mountedRef.current) return;
        nonceRef.current = nonce;
        gis.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredential,
          nonce: hashedNonce,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        const host = buttonRef.current;
        if (!host) { toFallback('no container'); return; }
        host.innerHTML = '';
        // Width is the ONLY thing we tell Google about appearance. Its own
        // limits are 200 to 400, and the shell is narrower than 400 on a phone.
        const measured = Math.round(host.getBoundingClientRect().width) || 320;
        gis.renderButton(host, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: Math.max(200, Math.min(400, measured)),
        });

        // renderButton returns before anything is painted, and returns just as
        // quietly when it will never paint at all. Poll until a real child with
        // height shows up, or give up and use the redirect button.
        const deadline = Date.now() + 2500;
        const check = () => {
          if (cancelled || !mountedRef.current) return;
          const el = buttonRef.current;
          const rendered = !!el && el.childElementCount > 0 && el.getBoundingClientRect().height > 0;
          if (rendered) {
            console.info('[carpool] Google sign in path: gis (button rendered)');
            setPath('gis');
            return;
          }
          if (Date.now() >= deadline) {
            toFallback('GIS rendered nothing, check the authorized JavaScript origins');
            return;
          }
          pollTimer = setTimeout(check, 150);
        };
        check();
      } catch (e) {
        toFallback(e?.message ?? 'setup failed');
      }
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AUTH FIRST, and that is the whole point of the design. The email path is
  // form first: fill the family in, stash it, verify a code, and Ready applies
  // the stash. Google inverts that. The parent taps this before typing
  // anything, so there is no payload to stash and stashPendingFamily is never
  // called on this path, on EITHER of the two Google flows. They come back
  // authenticated with no family row, Ready renders FamilyForm, and
  // FamilyForm's own onSubmitData saves it directly. The stash and its matching
  // rules are simply not in the picture.
  //
  // redirectTo is computed here rather than read from an env var so the same
  // build works on localhost:5173 and on wearercap.org. It must be the carpool
  // page itself: '/carpool/' is a separate Vite entry, and landing on '/' would
  // drop the parent on the marketing site holding a fresh session.
  //
  // WHY THERE IS A PREFLIGHT HERE, verified live against the real project on
  // 2026-07-20 while the provider was still disabled:
  //
  // signInWithOAuth never talks to the server. It builds the /authorize URL on
  // the client and calls window.location.assign, then returns { error: null }
  // unconditionally. So a disabled provider does NOT come back as an error we
  // can map, and it does NOT redirect back to us with error params either. The
  // parent is navigated off site and left staring at raw JSON on a
  // supabase.co URL with no way back:
  //
  //   {"code":400,"error_code":"validation_failed",
  //    "msg":"Unsupported provider: provider is not enabled"}
  //
  // That is the actual dormant behavior, and it is worse than a crash because
  // it happens on someone else's domain. So we ask /authorize the question
  // before we send anyone there. skipBrowserRedirect gives us the exact URL the
  // SDK would have navigated to and nothing else: _handleProviderSignIn does
  // not pass that flag down to _getUrlForProvider, so the URL comes back clean,
  // with no skip_http_redirect param riding along, and the PKCE verifier (if
  // flowType ever moves off the current default of implicit) is still stored as
  // a side effect exactly as it would be normally.
  //
  // The probe is FAIL OPEN by design. GoTrue sends permissive CORS, so a
  // disabled provider gives us a readable 400 body. A working provider gives a
  // 302 toward Google, which under redirect:'manual' surfaces as an
  // opaqueredirect we deliberately do not follow. Anything else, including the
  // probe throwing on a flaky phone connection or a proxy eating it, falls
  // through to the real redirect: a parent must never be blocked from signing
  // in by a diagnostic. Only a body we positively read as an error stops them.
  //
  // The finally clause is load bearing. supabase-js returns { error } only for
  // auth errors and THROWS everything else (a network failure mid-tap on a
  // phone), and this codebase has shipped buttons stranded in their busy state
  // that way before. The button re-enables on every exit path except the one
  // where the browser is genuinely on its way to Google.
  async function handleGoogle() {
    setGoogleStatus('redirecting');
    setGoogleError('');
    let leaving = false;
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/carpool/',
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        if (mountedRef.current) setGoogleError(mapOAuthError(error.message));
        return;
      }
      if (!data?.url) {
        if (mountedRef.current) setGoogleError(mapOAuthError(''));
        return;
      }

      const blocked = await describeProviderFailure(data.url);
      if (blocked) {
        if (mountedRef.current) setGoogleError(mapOAuthError(blocked));
        return;
      }

      leaving = true;
      window.location.assign(data.url);
    } catch (err) {
      if (mountedRef.current) {
        setGoogleError(err.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      if (mountedRef.current && !leaving) setGoogleStatus('idle');
    }
  }

  return (
    <>
      <div ref={buttonRef} className={path === 'fallback' ? 'cp-gsi cp-gsi--off' : 'cp-gsi'} />
      {path === 'fallback' && (
        <button
          className="cp-btn cp-btn--ghost cp-btn--block"
          type="button"
          onClick={handleGoogle}
          disabled={googleStatus === 'redirecting'}
        >
          <GoogleMark />
          {googleStatus === 'redirecting' ? 'Opening Google' : 'Continue with Google'}
        </button>
      )}
      {googleStatus === 'verifying' && <p className="cp-help">Signing you in with Google</p>}
      {googleError && <p className="cp-google-alert" role="alert">{googleError}</p>}
    </>
  );
}

// Form-first onboarding: a parent fills out the family form, we stash it
// locally, send an emailed 6-digit code, and verify it inline without ever
// sending them off the page. Task 3 makes Ready pick up the stash and save
// the family once auth completes (RLS requires an authenticated user_id).
export default function Onboarding() {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [step, setStep] = useState('form'); // 'form' | 'code' | 'signin-email'
  // Which step "Use a different email" should return to from the code step.
  const [origin, setOrigin] = useState('form');
  const [email, setEmail] = useState('');
  // Snapshot of the last-submitted family form, in FamilyForm's `family`
  // prop shape, so returning to the form step (e.g. "Use a different
  // email") re-mounts it pre-filled instead of blank. Seeded lazily from
  // any stash left over from a previous mount (e.g. a reload while
  // switching to the mail app to read the code) so the draft survives that
  // reload instead of coming back blank. Deliberately does NOT auto-jump to
  // the code step; starting back on the prefilled form is the safer
  // behavior since we can't know the code was ever sent successfully.
  // A stash whose SHAPE drifted (e.g. written before a deploy that changed the
  // payload) would make stashToFormShape throw during render. There is no error
  // boundary above this component, so that would white-screen the signed-out
  // entry point and survive a reload, bricking the tab. Discard it instead.
  const [draft, setDraft] = useState(() => {
    try {
      const p = readPendingFamily();
      return p ? stashToFormShape(p) : null;
    } catch {
      clearPendingFamily();
      return null;
    }
  });

  const [code, setCode] = useState('');
  const [verifyStatus, setVerifyStatus] = useState('idle'); // idle | verifying | error
  const [verifyError, setVerifyError] = useState('');
  const [resendStatus, setResendStatus] = useState('idle'); // idle | sending | sent | error
  const [resendMessage, setResendMessage] = useState('');

  const [signinEmail, setSigninEmail] = useState('');
  const [signinStatus, setSigninStatus] = useState('idle'); // idle | sending | error
  const [signinError, setSigninError] = useState('');

  function goToCode(nextEmail, nextOrigin) {
    if (!mountedRef.current) return;
    setEmail(nextEmail);
    setOrigin(nextOrigin);
    setCode('');
    setVerifyStatus('idle');
    setVerifyError('');
    setResendStatus('idle');
    setResendMessage('');
    setStep('code');
  }

  // Stash the family locally first (so nothing is lost if the email send
  // fails), then send the code. Errors are NOT swallowed here: FamilyForm
  // awaits this and shows whatever it throws via its own error slot.
  async function handleFamilySubmit(payload) {
    stashPendingFamily(payload);
    setDraft(stashToFormShape(payload));
    const { error } = await supabase.auth.signInWithOtp({
      email: payload.contactEmail,
      options: { shouldCreateUser: true },
    });
    if (error) throw new Error(mapSendError(error.message));
    goToCode(payload.contactEmail, 'form');
  }

  async function handleSigninSubmit(e) {
    e.preventDefault();
    setSigninStatus('sending');
    setSigninError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: signinEmail,
        options: { shouldCreateUser: false },
      });
      if (!mountedRef.current) return;
      if (error) {
        setSigninStatus('error');
        // Supabase returns something like "Signups not allowed for otp" when
        // shouldCreateUser: false hits an email with no account. Map that
        // specific case to language a parent will actually understand; leave
        // every other error message passing through unchanged.
        const message = /signups not allowed for otp/i.test(error.message ?? '')
          ? "We don't have a family under that email. Check the spelling, or start as a new family."
          : mapSendError(error.message);
        setSigninError(message);
        return;
      }
      setSigninStatus('idle');
      goToCode(signinEmail, 'signin-email');
    } catch (err) {
      // supabase-js only returns { error } for auth errors; anything else
      // (e.g. TypeError: Failed to fetch when offline or on flaky mobile)
      // is thrown. Without this catch the button would stay disabled on
      // 'sending' forever with no error shown.
      if (!mountedRef.current) return;
      setSigninStatus('error');
      setSigninError(err.message ?? 'Something went wrong. Please try again.');
    }
  }

  // supabase-js v2's EmailOtpType is 'signup' | 'invite' | 'magiclink' |
  // 'recovery' | 'email_change' | 'email'. The SDK's own docs mark 'signup'
  // and 'magiclink' deprecated and say 'email' is "used when verifying an
  // OTP sent to the user's email during sign-up or sign-in" — one type
  // covers both the brand-new user from the form step and a returning user
  // from the sign-in step, so no retry-with-a-different-type is needed.
  async function handleVerify(e) {
    e.preventDefault();
    setVerifyStatus('verifying');
    setVerifyError('');
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (!mountedRef.current) return;
      if (error) {
        setVerifyStatus('error');
        setVerifyError(mapVerifyError(error.message));
        return;
      }
      setVerifyStatus('idle');
      // Success: onAuthStateChange in App.jsx re-renders into the signed-in
      // view. Nothing else to do here.
    } catch (err) {
      // A network throw here is the worst case: a parent holding a valid
      // code on what would otherwise be a dead page (button stuck on
      // 'verifying' with no error shown). Recover into 'error' so they can
      // retry.
      if (!mountedRef.current) return;
      setVerifyStatus('error');
      setVerifyError(err.message ?? 'Something went wrong. Please try again.');
    }
  }

  async function handleResend() {
    setResendStatus('sending');
    setResendMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: origin === 'form' },
      });
      if (!mountedRef.current) return;
      if (error) {
        setResendStatus('error');
        setResendMessage(mapSendError(error.message));
        return;
      }
      setResendStatus('sent');
      setResendMessage('A new code is on its way.');
    } catch (err) {
      if (!mountedRef.current) return;
      setResendStatus('error');
      setResendMessage(err.message ?? 'Something went wrong. Please try again.');
    }
  }

  if (step === 'form') {
    return (
      <div className="carpool-shell">
        <p className="cp-label"><span className="cp-num">01</span>Optional, parent-run</p>
        {/* "RCAP Carpool", never "RCA Carpool": RCAP is the parent community's
            own brand, and this tool is parent-run. Naming it after the school
            implies the school sponsors it, which it does not (Mose,
            2026-07-19). Same rule for every email subject and sender name. */}
        <h1 className="cp-h1">RCAP Carpool for <span className="cp-hl">families.</span></h1>
        {/* Framing set at the top on purpose (Mose, 2026-07-21): the entry was
            reading like an RCA program you enroll in, when it is a tool some
            parents made that you can take or leave. "tool", "optional", "want
            to", and the closing line carry that. Do not water this down back
            into "add your family and we will..." which reads as an
            instruction. */}
        <p className="cp-lede">A free tool some RCA parents built for families who want to share the school drive. It is optional. If carpooling would help you, add your family and we will show you who lives nearby. Nobody is required to be here.</p>
        {/* Google goes ABOVE the form on purpose. A parent who fills in every
            field and then taps it loses all of that typing to the redirect, so
            the choice has to come before the investment, not after it. */}
        <p className="cp-help">Quickest way in. No code to wait for.</p>
        <GoogleSignIn />
        <p className="cp-or">Or use your email</p>
        <FamilyForm family={draft} submitLabel="Continue" heading="Your family" onSubmitData={handleFamilySubmit} />
        <hr className="cp-rule" />
        <p className="cp-fine">
          Already added your family?{' '}
          <button
            className="cp-btn cp-btn--quiet"
            type="button"
            onClick={() => {
              // A stash written while filling this form out has no purpose
              // on the sign-in path; don't let it linger for the tab's life.
              clearPendingFamily();
              setStep('signin-email');
            }}
          >Sign in</button>
        </p>
      </div>
    );
  }

  if (step === 'signin-email') {
    return (
      <div className="carpool-shell">
        <p className="cp-label cp-label--bar">Welcome back</p>
        <h1 className="cp-h1">Sign <span className="cp-hl">in.</span></h1>
        <p className="cp-lede">Enter the email you used to add your family and we will send you a code.</p>
        <GoogleSignIn />
        <p className="cp-or">Or use your email</p>
        <form onSubmit={handleSigninSubmit}>
          <div className={signinError ? 'cp-field cp-field--invalid' : 'cp-field'}>
            <label className="cp-field-label" htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              type="email"
              required
              value={signinEmail}
              onChange={(e) => setSigninEmail(e.target.value)}
            />
          </div>
          {signinError && <p role="alert">{signinError}</p>}
          <button className="cp-btn cp-btn--primary cp-btn--block" type="submit" disabled={signinStatus === 'sending'}>
            {signinStatus === 'sending' ? 'Sending…' : 'Send me a code'}
            <span className="cp-arr" aria-hidden="true">→</span>
          </button>
        </form>
        <hr className="cp-rule" />
        <p className="cp-fine">
          New to carpool?{' '}
          <button className="cp-btn cp-btn--quiet" type="button" onClick={() => setStep('form')}>Add your family</button>
        </p>
      </div>
    );
  }

  // step === 'code'
  return (
    <div className="carpool-shell">
      <p className="cp-label"><span className="cp-num">02</span>Almost there</p>
      <h1 className="cp-h1">Check your <span className="cp-hl">email.</span></h1>
      <p className="cp-lede">We sent a 6-digit code to {email}.</p>
      <form onSubmit={handleVerify}>
        <div className={verifyError ? 'cp-field cp-field--invalid' : 'cp-field'}>
          <label className="cp-field-label" htmlFor="otp-code">Your 6-digit code</label>
          <input
            id="otp-code"
            className="cp-code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            minLength={6}
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </div>
        {verifyError && <p role="alert">{verifyError}</p>}
        <button className="cp-btn cp-btn--primary cp-btn--block" type="submit" disabled={verifyStatus === 'verifying'}>
          {verifyStatus === 'verifying' ? 'Verifying…' : 'Verify my code'}
          <span className="cp-arr" aria-hidden="true">→</span>
        </button>
      </form>
      <hr className="cp-rule" />
      <p className="cp-fine">
        <button className="cp-btn cp-btn--quiet" type="button" onClick={handleResend} disabled={resendStatus === 'sending'}>
          {resendStatus === 'sending' ? 'Sending…' : 'Send a new code'}
        </button>
        {resendStatus === 'sent' && <span className="cp-serif"> {resendMessage}</span>}
        {resendStatus === 'error' && <span role="alert"> {resendMessage}</span>}
      </p>
      <p className="cp-fine">
        <button className="cp-btn cp-btn--quiet" type="button" onClick={() => setStep(origin)}>Use a different email</button>
      </p>
    </div>
  );
}
