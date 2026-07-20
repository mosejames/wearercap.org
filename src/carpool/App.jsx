import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { resolveView, fetchMember, ensureMemberRow } from './auth.js';
import { useHashRoute, clearHash } from './hashRoute.js';
import Onboarding from './views/Onboarding.jsx';
import Ready from './views/Ready.jsx';
import SharingExplainer from './views/SharingExplainer.jsx';

// A token minted THIS instant can look like it came from the future.
//
// Seen live on the first Google sign-in (2026-07-20): Supabase issued the JWT,
// the very next request carried it, and the validator rejected it with "JWT
// issued at future", dumping a parent on the fatal error screen at the exact
// moment they were joining. Mose's machine clock measured zero skew against
// the server, because whole-second granularity hides the sub-second difference
// that actually causes this: if the browser is a fraction of a second behind
// whoever issues the token, an iat of "now" reads as later than now.
//
// It resolves itself within a second or two (the same token validated fine on
// the next page load), so the answer is to wait and retry rather than to widen
// any tolerance. Matched narrowly on purpose: every OTHER error must still
// reach the error screen immediately, because a real failure that silently
// retries three times is worse than one that shows up.
function isClockSkewError(e) {
  return /issued at future|token used before issued/i.test(e?.message ?? '');
}

async function withClockSkewRetry(fn, attempts = 3, delayMs = 700) {
  for (let i = 0; ; i += 1) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts - 1 || !isClockSkewError(e)) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// Presentational only. Wraps whichever view App already decided to render so
// the masthead and footer are identical on every screen.
function Shell({ children }) {
  return (
    <>
      <header className="cp-masthead">
        <p className="cp-brand">
          RCA<span className="cp-hl">P</span>
          <span className="cp-brand-sub">We Are RCAP</span>
        </p>
        <p className="cp-issue">Carpool</p>
      </header>
      {children}
      <footer className="cp-footer">
        <p className="cp-fmark">RCA<span className="cp-hl">P</span></p>
        <p>A parent-run carpool board for Ron Clark Academy families.</p>
        {/* On EVERY screen, not just the sharing page. A disclaimer only a
            reader who goes looking will find is not much of a disclaimer, and
            this is the line that travels with a forwarded screenshot. */}
        <p className="cp-fnote">
          Organized by parent volunteers. Not sponsored by or affiliated with
          Ron Clark Academy. <a href="#sharing">How sharing works</a>
        </p>
      </footer>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hash = useHashRoute();
  // #sharing works signed in or out (a parent deciding whether to sign up
  // deserves the same answer). #admin is gated below, once the session and
  // member row have actually resolved.
  const sharingOpen = hash === '#sharing';
  const adminHash = hash === '#admin';

  useEffect(() => {
    let active = true;
    let timeoutId = null;

    async function load(nextSession) {
      try {
        if (nextSession?.user) {
          await withClockSkewRetry(() => ensureMemberRow(nextSession.user));
          const m = await withClockSkewRetry(() => fetchMember(nextSession.user.id));
          if (!active) return;
          setMember(m);
        } else {
          setMember(null);
        }
      } catch (e) {
        if (active) setError(e.message ?? 'Something went wrong.');
      } finally {
        if (active) setLoading(false);
      }
    }

    // Drive all loading from onAuthStateChange alone. In supabase-js v2,
    // this fires an INITIAL_SESSION event on subscribe with the current
    // session (or null), so a separate getSession() call is redundant.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(true);
      // Defer async Supabase calls off the callback's synchronous execution
      // per supabase-js guidance (the auth client may hold an internal lock).
      timeoutId = setTimeout(() => {
        load(nextSession);
      }, 0);
    });

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
      sub.subscription.unsubscribe();
    };
  }, []);

  // The sharing page renders INSTEAD of the current view, not on top of it,
  // and before the loading gate so it is readable even mid-auth. Back = clear
  // the hash; history.back() would leave the app if #sharing was the entry
  // URL someone was sent by a friend.
  if (sharingOpen) {
    return (
      <Shell>
        <SharingExplainer onBack={clearHash} />
      </Shell>
    );
  }

  if (loading) return (
    <Shell>
      <div className="carpool-shell"><p className="cp-loading">Loading your carpool</p></div>
    </Shell>
  );
  if (error) return (
    <Shell>
      <div className="carpool-shell">
        <p className="cp-label cp-label--bar">Something went wrong</p>
        <p role="alert">{error}</p>
        <button className="cp-btn cp-btn--dark cp-btn--block" onClick={() => window.location.reload()}>
          Try again <span className="cp-arr" aria-hidden="true">→</span>
        </button>
      </div>
    </Shell>
  );

  const view = resolveView(session, member);
  if (view === 'signed-out') return <Shell><Onboarding /></Shell>;
  // One-sitting onboarding: pending parents fill their family and see the
  // map teaser immediately; approval gates only other families' details.
  //
  // #admin is honoured only once we are past the loading gate above and the
  // resolved view is 'admin'. A signed-out or non-admin visitor on that URL
  // gets their normal screen and no error: the hash is simply ignored.
  return (
    <Shell>
      <Ready
        isAdmin={view === 'admin'}
        isPending={view === 'pending'}
        openAdmin={adminHash && view === 'admin'}
      />
    </Shell>
  );
}
