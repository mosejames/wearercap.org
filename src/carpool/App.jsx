import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { resolveView, fetchMember, ensureMemberRow } from './auth.js';
import SignedOut from './views/SignedOut.jsx';
import Ready from './views/Ready.jsx';

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

  if (loading) return <div className="carpool-shell"><p>Loading…</p></div>;
  if (error) return (
    <div className="carpool-shell">
      <p role="alert">Something went wrong: {error}</p>
      <button onClick={() => window.location.reload()}>Try again</button>
    </div>
  );

  const view = resolveView(session, member);
  if (view === 'signed-out') return <SignedOut />;
  // One-sitting onboarding: pending parents fill their family and see the
  // map teaser immediately; approval gates only other families' details.
  return <Ready isAdmin={view === 'admin'} isPending={view === 'pending'} />;
}
