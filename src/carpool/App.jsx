import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { resolveView, fetchMember, ensureMemberRow } from './auth.js';
import Onboarding from './views/Onboarding.jsx';
import Ready from './views/Ready.jsx';

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
      </footer>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let timeoutId = null;

    async function load(nextSession) {
      try {
        if (nextSession?.user) {
          await ensureMemberRow(nextSession.user);
          const m = await fetchMember(nextSession.user.id);
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
  return <Shell><Ready isAdmin={view === 'admin'} isPending={view === 'pending'} /></Shell>;
}
