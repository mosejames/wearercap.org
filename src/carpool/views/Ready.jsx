import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { fetchFamily, buildFamilyRecord, saveFamily } from '../family.js';
import { readPendingFamily, clearPendingFamily } from '../pendingFamily.js';
import FamilyForm from './FamilyForm.jsx';
import AdminApprovals from './AdminApprovals.jsx';
import MapView from './MapView.jsx';

export default function Ready({ isAdmin = false, isPending = false }) {
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
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
        let fam = user ? await fetchFamily(user.id) : null;
        if (!active) return;
        if (!fam && user) {
          const pending = readPendingFamily();
          if (pending) {
            const record = buildFamilyRecord({ ...pending, userId: user.id });
            await saveFamily(record);
            if (!active) return;
            clearPendingFamily();
            fam = record;
          }
        }
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

  // Admins can jump to the approvals queue and back, without leaving their family view.
  if (isAdmin && showApprovals) {
    return <AdminApprovals onBack={() => setShowApprovals(false)} />;
  }

  const adminBar = isAdmin ? (
    <div className="carpool-shell" style={{ paddingBottom: 0 }}>
      <button onClick={() => setShowApprovals(true)}>Pending approvals →</button>
    </div>
  ) : null;

  const pendingBanner = isPending ? (
    <div className="carpool-shell" style={{ paddingBottom: 0 }}>
      <p><strong>You're awaiting approval.</strong> A committee admin has been notified — meanwhile, set up your family below.</p>
    </div>
  ) : null;

  if (!family || editing) {
    return (
      <>
        {pendingBanner}
        {adminBar}
        <FamilyForm
          family={family}
          initialEmail={email}
          onSubmitData={async (payload) => {
            const record = buildFamilyRecord({ ...payload, userId });
            await saveFamily(record);
            setFamily(record);
            setEditing(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      {pendingBanner}
      {adminBar}
      <div className="carpool-shell">
        <h1>Your family</h1>
        <p><strong>{family.parent_name}</strong> — {family.child_names}</p>
        <p>Area: {family.area_label}</p>
        <p>Needs: {family.direction === 'both' ? 'Morning & afternoon' : family.direction === 'am' ? 'Morning' : 'Afternoon'} · {family.weekdays.join(', ')}</p>
        <button onClick={() => setEditing(true)}>Edit</button>
        <MapView family={family} isPending={isPending} />
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </>
  );
}
