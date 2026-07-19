import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { fetchFamily, buildFamilyRecord, saveFamily } from '../family.js';
import { readPendingFamily, clearPendingFamily } from '../pendingFamily.js';
import FamilyForm from './FamilyForm.jsx';
import AdminApprovals from './AdminApprovals.jsx';
import MapView from './MapView.jsx';
import Groups from './Groups.jsx';

// Builds a family record from a stashed onboarding/edit payload, saves it,
// and clears the stash. Used both when the signed-in user has no family row
// yet (first-time onboarding) and when they already have one (re-onboarding:
// they forgot they'd signed up, refilled the form, and this stash is their
// freshest deliberate input — saveFamily upserts, so applying it here is
// safe either way). There is exactly ONE place that builds/saves/clears so
// the two callers can't drift.
//
// A stash that fails to build into a record (missing/invalid field, e.g.
// written before a deploy that changed the payload shape) is unusable and
// would throw identically forever if retried, bricking this view behind a
// reload loop. Discard it and signal the caller to keep whatever family it
// already had. A throw from saveFamily itself is different: that's a
// transient failure (network, RLS, etc.), so the stash must survive it so
// the save can be retried, and it propagates to the caller uncaught.
async function applyPendingFamily(pending, userId) {
  let record;
  try {
    record = buildFamilyRecord({ ...pending, userId });
  } catch {
    clearPendingFamily();
    return null;
  }
  await saveFamily(record); // a throw here must NOT clear the stash
  clearPendingFamily();
  return record;
}

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
        if (user) {
          const pending = readPendingFamily();
          if (pending) {
            // Shared-computer edge case: tab A stashed a draft and signed
            // out, tab B signs in as someone else, the Supabase session
            // broadcasts to tab A. Only consume a stash that belongs to
            // THIS account. On the intended path these always match, since
            // onboarding signs in with payload.contactEmail.
            if (pending.contactEmail?.toLowerCase() === user.email?.toLowerCase()) {
              const applied = await applyPendingFamily(pending, user.id);
              // Clearing the stash above is a pure local side effect and is
              // correct regardless of mount state; only setState needs the
              // mount guard, so it comes after.
              if (!active) return;
              if (applied) fam = applied;
            } else {
              clearPendingFamily();
            }
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

  if (loading) return <div className="carpool-shell"><p className="cp-loading">Loading your family</p></div>;
  if (error) return (
    <div className="carpool-shell">
      <p className="cp-label cp-label--bar">Something went wrong</p>
      <p role="alert">{error}</p>
      <button className="cp-btn cp-btn--dark cp-btn--block" onClick={() => window.location.reload()}>
        Try again <span className="cp-arr" aria-hidden="true">→</span>
      </button>
    </div>
  );

  // Admins can jump to the approvals queue and back, without leaving their family view.
  if (isAdmin && showApprovals) {
    return <AdminApprovals onBack={() => setShowApprovals(false)} />;
  }

  const adminBar = isAdmin ? (
    <div className="carpool-shell" style={{ paddingBottom: 0 }}>
      <button className="cp-btn cp-btn--dark cp-btn--block" onClick={() => setShowApprovals(true)}>
        Pending approvals <span className="cp-arr" aria-hidden="true">→</span>
      </button>
    </div>
  ) : null;

  const pendingBanner = isPending ? (
    <div className="carpool-shell" style={{ paddingBottom: 0 }}>
      <div className="cp-banner cp-banner--info">
        <strong>You're awaiting approval.</strong> A committee admin has been notified. Meanwhile, set up your family below.
      </div>
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
        <p className="cp-label cp-label--bar">Your account</p>
        <h1 className="cp-h1">Your <span className="cp-hl">family.</span></h1>
        <div className="cp-card">
          <p className="cp-item-name">{family.parent_name}</p>
          <p className="cp-item-meta">{family.child_names}</p>
          <p className="cp-item-meta">Area {family.area_label}</p>
          <p className="cp-item-meta">
            {family.direction === 'both' ? 'Morning & afternoon' : family.direction === 'am' ? 'Morning' : 'Afternoon'} · {family.weekdays.join(', ')}
          </p>
          <div className="cp-item-actions">
            <button className="cp-btn cp-btn--ghost cp-btn--sm" onClick={() => setEditing(true)}>Edit my family</button>
          </div>
        </div>
        <MapView family={family} isPending={isPending} />
        {/* Same branch as MapView, so family (and therefore
            family.area_lat/area_lng) is always present: rankGroups measures
            every distance against it. Approved members only. */}
        {!isPending && <Groups family={family} userId={userId} />}
        <hr className="cp-rule" />
        <button className="cp-btn cp-btn--quiet" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </>
  );
}
