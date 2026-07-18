import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { stashPendingFamily, readPendingFamily, clearPendingFamily } from '../pendingFamily.js';
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
  const [draft, setDraft] = useState(() => {
    const p = readPendingFamily();
    return p ? stashToFormShape(p) : null;
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
    if (error) throw error;
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
          : (error.message ?? 'Could not send a code. Please try again.');
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
        setResendMessage(error.message ?? 'Could not send a new code. Please try again.');
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
        <h1>Welcome to RCA Carpool</h1>
        <p>Add your family and we'll show you who is already carpooling near you.</p>
        <FamilyForm family={draft} submitLabel="Continue" heading="Your family" onSubmitData={handleFamilySubmit} />
        <p>
          Already added your family?{' '}
          <button
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
        <h1>Sign in</h1>
        <p>Enter the email you used to add your family and we'll send you a code.</p>
        <form onSubmit={handleSigninSubmit}>
          <label>Email
            <input
              type="email"
              required
              value={signinEmail}
              onChange={(e) => setSigninEmail(e.target.value)}
            />
          </label>
          {signinError && <p role="alert">{signinError}</p>}
          <button type="submit" disabled={signinStatus === 'sending'}>
            {signinStatus === 'sending' ? 'Sending…' : 'Send me a code'}
          </button>
        </form>
        <p>
          <button type="button" onClick={() => setStep('form')}>I'm new here</button>
        </p>
      </div>
    );
  }

  // step === 'code'
  return (
    <div className="carpool-shell">
      <h1>Check your email</h1>
      <p>We sent a 6-digit code to {email}.</p>
      <form onSubmit={handleVerify}>
        <label>Code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            minLength={6}
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </label>
        {verifyError && <p role="alert">{verifyError}</p>}
        <button type="submit" disabled={verifyStatus === 'verifying'}>
          {verifyStatus === 'verifying' ? 'Verifying…' : 'Verify'}
        </button>
      </form>
      <p>
        <button type="button" onClick={handleResend} disabled={resendStatus === 'sending'}>
          {resendStatus === 'sending' ? 'Sending…' : 'Send a new code'}
        </button>
        {resendStatus === 'sent' && <span> {resendMessage}</span>}
        {resendStatus === 'error' && <span role="alert"> {resendMessage}</span>}
      </p>
      <p>
        <button type="button" onClick={() => setStep(origin)}>Use a different email</button>
      </p>
    </div>
  );
}
