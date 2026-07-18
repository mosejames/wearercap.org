import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { fetchFamily } from '../family.js';
import FamilyForm from './FamilyForm.jsx';

export default function Ready() {
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!active) return;
        setUserId(user?.id ?? null);
        setEmail(user?.email ?? '');
        const fam = user ? await fetchFamily(user.id) : null;
        if (!active) return;
        setFamily(fam);
      } catch (e) {
        if (active) setError(e.message ?? 'Could not load your family.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <div className="carpool-shell"><p>Loading…</p></div>;
  if (error) return (
    <div className="carpool-shell">
      <p role="alert">Something went wrong: {error}</p>
      <button onClick={() => window.location.reload()}>Try again</button>
    </div>
  );

  if (!family || editing) {
    return (
      <FamilyForm
        userId={userId}
        email={email}
        family={family}
        onSaved={(rec) => { setFamily(rec); setEditing(false); }}
      />
    );
  }

  return (
    <div className="carpool-shell">
      <h1>Your family</h1>
      <p><strong>{family.parent_name}</strong> — {family.child_names}</p>
      <p>Area: {family.area_label}</p>
      <p>Needs: {family.direction === 'both' ? 'Morning & afternoon' : family.direction === 'am' ? 'Morning' : 'Afternoon'} · {family.weekdays.join(', ')}</p>
      <button onClick={() => setEditing(true)}>Edit</button>
      <p>The map of nearby families arrives next.</p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  );
}
