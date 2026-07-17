import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { resolveView, fetchMember, ensureMemberRow } from './auth.js';
import SignedOut from './views/SignedOut.jsx';
import Pending from './views/Pending.jsx';
import Ready from './views/Ready.jsx';
import AdminApprovals from './views/AdminApprovals.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

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

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      load(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(true);
      load(nextSession);
    });

    return () => {
      active = false;
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
  if (view === 'pending') return <Pending />;
  if (view === 'admin') return <AdminApprovals />;
  return <Ready />;
}
