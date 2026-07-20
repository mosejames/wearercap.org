import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchPendingSignups,
  fetchAllFamilies,
  fetchAllGroups,
  fetchAutoApprove,
  fetchOrganizerFlags,
  approveMember,
  declineSignup,
  unapproveMember,
  setAutoApprove,
  setCanOrganize,
  removeFromGroup,
  deleteGroup,
} from '../admin.js';
import { summarizeSchedule } from '../groups.js';
import { loadMaps, loadMarker } from '../maps.js';

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID';

// Same translation policy as Groups.jsx's mapGroupsError: turn operational
// gibberish ("schema cache", "Failed to fetch") into a sentence, and pass
// everything else through untouched. The pass-through half matters most here:
// the 0006 RPCs raise their guard messages in parent-readable form ("That
// family is approved; un-approve them first", "An admin account cannot be
// declined"), and those must reach the admin exactly as written.
function mapAdminError(message, fallback) {
  const msg = message ?? '';
  if (/schema cache/i.test(msg) || /relation .* does not exist/i.test(msg)) {
    return 'The admin tools are not ready on our side yet. Please try again later.';
  }
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(msg)) {
    return 'We could not reach the server. Check your connection, then try again.';
  }
  return msg || fallback;
}

// Small deterministic offset so families sharing a ZIP centroid don't render
// as a single stacked pin. Same numbers as MapView. Display only.
const JITTER_DEGREES = 0.002;
function jitter(lat, lng, index) {
  if (index === 0) return { lat, lng };
  const angle = (index * 137.5 * Math.PI) / 180; // golden-angle spread
  return {
    lat: lat + JITTER_DEGREES * Math.cos(angle),
    lng: lng + JITTER_DEGREES * Math.sin(angle),
  };
}

// Jittered pin positions for every family, grouped by shared centroid and
// ordered deterministically inside each group, exactly as MapView does it.
function pinPositions(families) {
  const grouped = {};
  families.forEach((f) => {
    const key = `${f.area_lat},${f.area_lng}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  });
  const pins = [];
  Object.values(grouped).forEach((group) => {
    group.sort((a, b) => a.user_id.localeCompare(b.user_id));
    group.forEach((f, withinGroupIndex) => {
      pins.push({ family: f, position: jitter(f.area_lat, f.area_lng, withinGroupIndex) });
    });
  });
  return pins;
}

// autoApprove starts true because that is what the database does when the
// setting cannot be read (auto_approve_enabled() coalesces to true, and the
// column default matches it). The Settings card only renders once loaded is
// true, so this value is never actually shown before a real read lands.
const EMPTY = { queue: [], families: [], groups: [], organizers: [], autoApprove: true };

export default function Admin({ onBack = null }) {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Bumped on every entry to load(). A load only writes state if its own
  // sequence number is still the newest, so a slow earlier fetch can never
  // land on top of a newer one and resurrect a signup the admin just declined.
  const loadSeqRef = useRef(0);

  // Mirrors busyKey. State updates are async, so two taps inside one tick
  // would both read an empty busyKey; the ref is what actually gates them.
  const busyRef = useRef('');

  const mapContainerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [data, setData] = useState(EMPTY);
  const [mapError, setMapError] = useState('');
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState(() => new Set());

  // One refetch routine for the whole panel. Every action calls it when it
  // finishes, succeed or fail, so a card never sits on a state the database
  // has already moved past. Decline can cascade whole groups away (the RPC's
  // five-table sweep), so all three datasets reload together; there is no
  // per-section refresh.
  //
  // This never throws. Callers run it inside a finally block, where a throw
  // would replace the real error the admin needs to read.
  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const current = () => mountedRef.current && seq === loadSeqRef.current;
    try {
      // The last two read objects that migration 0008 creates. They are
      // caught individually rather than allowed to reject the whole load,
      // because without this a not-yet-applied 0008 takes the ENTIRE panel
      // down: no queue, no roster, no moderation buttons, just one error.
      // That would make the deploy order load-bearing, and a panel that can
      // still remove a family is worth more than a toggle that renders.
      // Degraded values match the defaults their consumers already assume:
      // auto-approve reads as on (same as the DB's coalesce), and an absent
      // organizer flag renders as "cannot start groups".
      const [queue, families, groups, autoApprove, organizers] = await Promise.all([
        fetchPendingSignups(),
        fetchAllFamilies(),
        fetchAllGroups(),
        fetchAutoApprove().catch(() => true),
        fetchOrganizerFlags().catch(() => []),
      ]);
      if (!current()) return;
      setData({ queue, families, groups, autoApprove, organizers });
      setLoadError('');
      setLoaded(true);
    } catch (e) {
      // Drop everything we were showing rather than leave a stale queue or
      // roster on screen after a failed refetch. Showing nothing is the safe
      // direction here, same reasoning as Groups.jsx.
      if (current()) {
        setData(EMPTY);
        setLoaded(false);
        setLoadError(mapAdminError(e?.message, 'Could not load the admin panel.'));
      }
    } finally {
      if (current()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // The master map. Rebuilt whenever the families list changes; the container
  // only renders once there is at least one family, so the ref is always set
  // by the time this runs. Map failure never blocks the roster below it.
  useEffect(() => {
    if (data.families.length === 0) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [{ Map }, { AdvancedMarkerElement, PinElement }] = await Promise.all([loadMaps(), loadMarker()]);
        if (cancelled || !mapContainerRef.current) return;

        const pins = pinPositions(data.families);
        const map = new Map(mapContainerRef.current, {
          center: pins[0].position,
          zoom: 11,
          mapId: MAP_ID,
        });
        pins.forEach(({ family, position }) => {
          const pin = new PinElement({ background: '#ea4335', borderColor: '#8f1c11', glyphColor: '#ffffff' });
          new AdvancedMarkerElement({ map, position, content: pin.element, title: family.parent_name });
        });

        // Fit every pin. A literal bounds object avoids importing the core
        // library just for LatLngBounds; a single pin keeps the fixed zoom,
        // because fitBounds on a degenerate bounds zooms in to the maximum.
        if (pins.length > 1) {
          const lats = pins.map((p) => p.position.lat);
          const lngs = pins.map((p) => p.position.lng);
          map.fitBounds(
            {
              north: Math.max(...lats),
              south: Math.min(...lats),
              east: Math.max(...lngs),
              west: Math.min(...lngs),
            },
            48,
          );
        }
        if (!cancelled) setMapError('');
      } catch (err) {
        if (!cancelled) setMapError(err?.message ?? 'Could not load the map.');
      }
    })();
    return () => { cancelled = true; };
  }, [data.families]);

  // Every write goes through here, one at a time for the whole panel; same
  // single-slot reasoning as Groups.jsx. Freeing the button before the
  // refetch matters doubly here because load() pulls three datasets.
  async function run(key, work, successMessage) {
    if (busyRef.current) return;
    busyRef.current = key;
    setBusyKey(key);
    setActionError('');
    setNotice('');
    try {
      await work();
      if (mountedRef.current && successMessage) setNotice(successMessage);
    } catch (e) {
      if (mountedRef.current) {
        setActionError(mapAdminError(e?.message, 'Something went wrong. Please try again.'));
      }
    } finally {
      busyRef.current = '';
      if (mountedRef.current) setBusyKey('');
      await load();
    }
  }

  function toggleGroup(groupId) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  // Which groups each family sits in, and a name for every group member.
  // family_directory only returns approved families, so a membership row
  // whose user has no directory entry belongs to a family that has left.
  const familyByUser = new Map(data.families.map((f) => [f.user_id, f]));
  const groupNamesByUser = new Map();
  for (const g of data.groups) {
    for (const m of g.members) {
      if (!groupNamesByUser.has(m.user_id)) groupNamesByUser.set(m.user_id, []);
      groupNamesByUser.get(m.user_id).push(g.name);
    }
  }

  // The organizer flags, joined to the roster by user_id. A family with no
  // members row here is a row the flags query has not caught up with; it reads
  // as "cannot start groups", which is the database's own default.
  const organizerByUser = new Map(data.organizers.map((m) => [m.user_id, m]));

  const query = search.trim().toLowerCase();
  const visibleFamilies = query
    ? data.families.filter((f) =>
        [f.parent_name, f.child_names, f.area_label].some((v) => (v ?? '').toLowerCase().includes(query)),
      )
    : data.families;

  const showEmptyStates = loaded && !loading;

  return (
    <div className="carpool-shell">
      {onBack && <button className="cp-btn cp-btn--quiet cp-backlink" type="button" onClick={onBack}>← Back to my family</button>}
      <p className="cp-label cp-label--bar">Committee</p>
      <h1 className="cp-h1">Run the <span className="cp-hl">carpool.</span></h1>

      {loading && <p className="cp-loading">Loading the admin panel</p>}
      {loadError && (
        <p role="alert">
          {loadError}{' '}
          <button className="cp-btn cp-btn--quiet" type="button" onClick={() => { setLoading(true); load(); }}>Try again</button>
        </p>
      )}
      {actionError && <p role="alert">{actionError}</p>}
      {notice && <p role="status">{notice}</p>}

      {/* ---------------------------------------------------- settings -- */}
      {/* First on the page on purpose: this switch decides what the list
          below it even means. Reading the queue without knowing which way
          this is set tells an admin nothing. */}
      {loaded && (
        <>
          <h3 className="cp-h3">Settings</h3>
          <div className="cp-card">
            <p className="cp-item-name">
              New signups: {data.autoApprove ? 'approved automatically' : 'held for review'}
            </p>
            <p className="cp-fine">
              {data.autoApprove
                ? 'A family that signs up can see the family map straight away, without waiting for anyone. The list below stays empty unless you un-approve someone.'
                : 'A family that signs up waits in the list below and cannot see the family map until someone approves them. That means this page needs checking, because nobody gets in while it is not.'}
            </p>
            <p className="cp-fine">
              Either way, starting a group is a separate decision that stays with you. You hand
              that out one family at a time in the list further down.
            </p>
            <div className="cp-item-actions">
              <button
                className="cp-btn cp-btn--dark cp-btn--sm"
                type="button"
                disabled={busyKey === 'autoApprove'}
                onClick={() => {
                  const next = !data.autoApprove;
                  // Confirm only when loosening. Turning the review step back
                  // on is the safe direction and should not be nagged at.
                  if (next && !window.confirm('Approve new signups automatically? Anyone who confirms an email address will see the family map, with every family\'s name, children\'s names, and general area, without a person checking first.')) return;
                  run(
                    'autoApprove',
                    () => setAutoApprove(next),
                    next
                      ? 'New families are now approved as soon as they sign up.'
                      : 'New families now wait in the list below until someone approves them.',
                  );
                }}
              >
                {busyKey === 'autoApprove'
                  ? 'Saving…'
                  : data.autoApprove
                    ? 'Switch to holding signups for review'
                    : 'Switch to approving signups automatically'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ------------------------------------------------------- queue -- */}
      <h3 className="cp-h3 cp-h3--section">
        {data.autoApprove ? 'Un-approved families' : 'Waiting for approval'}
      </h3>
      {showEmptyStates && data.queue.length === 0 && (
        <div className="cp-empty">
          {/* The "empty is normal" line is only true while signups are
              approved automatically. With the switch off this list is the
              front door, and an empty one means nobody new has arrived yet,
              not that there is nothing to do. */}
          <p>
            {data.autoApprove
              ? 'Nothing here, which is the normal state. Families are approved when they join, so this list only fills up when you un-approve someone.'
              : 'No one is waiting right now. While signups are held for review, every new family lands here first and stays locked out until someone approves them, so check back.'}
          </p>
        </div>
      )}
      {data.queue.map((signup) => {
        const f = signup.family;
        // The reach-out address doubles as the display name for a signup with
        // no family details yet, and as the decline confirm's subject.
        const contactEmail = f?.contact_email || signup.email;
        const displayName = f?.parent_name || signup.email;
        return (
          <div className="cp-card" key={signup.userId}>
            <p className="cp-item-name">{displayName}</p>
            {f ? (
              <>
                <p className="cp-item-meta">{f.child_names}</p>
                <p className="cp-item-meta">{f.area_label} · {summarizeSchedule(f)}</p>
                <p className="cp-item-meta">{contactEmail}</p>
              </>
            ) : (
              <p className="cp-fine">No family details yet. They signed in but have not filled in the family form.</p>
            )}
            <div className="cp-item-actions">
              <button
                className="cp-btn cp-btn--primary cp-btn--sm"
                type="button"
                disabled={busyKey === `approve:${signup.userId}`}
                onClick={() => run(
                  `approve:${signup.userId}`,
                  () => approveMember(signup.userId),
                  `${displayName} is approved. They can now see the family map and join groups.`,
                )}
              >
                {busyKey === `approve:${signup.userId}` ? 'Approving…' : 'Approve'}
              </button>
              <a className="cp-btn cp-btn--ghost cp-btn--sm" href={`mailto:${contactEmail}`}>Email</a>
              <button
                className="cp-btn cp-btn--danger cp-btn--sm"
                type="button"
                disabled={busyKey === `decline:${signup.userId}`}
                onClick={() => {
                  if (!window.confirm(`Decline ${displayName}? Their signup and any family details will be deleted, and any group they created will be closed for its other families. They can sign up again later.`)) return;
                  run(
                    `decline:${signup.userId}`,
                    () => declineSignup(signup.userId),
                    `The signup from ${displayName} was declined and removed.`,
                  );
                }}
              >
                {busyKey === `decline:${signup.userId}` ? 'Declining…' : 'Decline'}
              </button>
            </div>
          </div>
        );
      })}

      {/* ---------------------------------------------------- families -- */}
      <h3 className="cp-h3 cp-h3--section">Families</h3>
      <p className="cp-fine">
        {data.autoApprove
          ? 'Every family that joins is approved right away, so this is where you review them.'
          : 'Every family you have approved is here, so this is where you review them.'}{' '}
        Read through the list and un-approve anyone who does not belong. Pins sit on general
        areas, not home addresses. This list shows exactly what approved parents already see
        about each other.
      </p>
      {showEmptyStates && data.families.length === 0 && (
        <div className="cp-empty">
          <p>No approved families yet.</p>
        </div>
      )}
      {data.families.length > 0 && (
        <>
          <div ref={mapContainerRef} className="carpool-map" />
          {mapError && <p className="cp-after-map" role="alert">{mapError}</p>}
          <div className="cp-field cp-after-map">
            <label className="cp-field-label" htmlFor="admin-family-search">Search families</label>
            <input
              id="admin-family-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Parent, child, or area"
            />
          </div>
          {visibleFamilies.length === 0 ? (
            <div className="cp-empty">
              <p>No family matches that search.</p>
            </div>
          ) : (
            <ul className="carpool-nearby-list">
              {visibleFamilies.map((f) => {
                const groupNames = groupNamesByUser.get(f.user_id) ?? [];
                const member = organizerByUser.get(f.user_id);
                // can_organize() in the database is true for any admin
                // regardless of the column, so an admin gets a statement of
                // fact rather than a switch that would change nothing.
                const isAdminFamily = member?.role === 'admin';
                const canOrganize = member?.can_organize === true;
                return (
                  <li key={f.user_id}>
                    <p className="cp-item-name">{f.parent_name}</p>
                    <p className="cp-item-meta">{f.child_names}</p>
                    <p className="cp-item-meta">{f.area_label} · {summarizeSchedule(f)}</p>
                    <p className="cp-item-meta">
                      {groupNames.length > 0 ? `Groups: ${groupNames.join(', ')}` : 'Not in any group'}
                    </p>
                    <p className="cp-item-meta">
                      {isAdminFamily
                        ? 'Committee admin, so they can always start groups'
                        : canOrganize
                          ? 'Can start groups: yes'
                          : 'Can start groups: no'}
                    </p>
                    <div className="cp-item-actions">
                      {!isAdminFamily && (
                        <button
                          className={canOrganize ? 'cp-btn cp-btn--ghost cp-btn--sm' : 'cp-btn cp-btn--dark cp-btn--sm'}
                          type="button"
                          disabled={busyKey === `organize:${f.user_id}`}
                          onClick={() => {
                            // Confirm only when granting. Taking it back is
                            // the safe direction, and the success message
                            // below says what it does not undo.
                            if (!canOrganize && !window.confirm(`Let ${f.parent_name} start carpool groups? Whoever runs a group can see the name, children's names, email, and phone of every family they accept into it.`)) return;
                            run(
                              `organize:${f.user_id}`,
                              () => setCanOrganize(f.user_id, !canOrganize),
                              canOrganize
                                ? `${f.parent_name} can no longer start new groups. Any group they already run keeps going.`
                                : `${f.parent_name} can now start a group.`,
                            );
                          }}
                        >
                          {busyKey === `organize:${f.user_id}`
                            ? 'Saving…'
                            : canOrganize
                              ? 'Stop letting them start groups'
                              : 'Let them start groups'}
                        </button>
                      )}
                      <button
                        className="cp-btn cp-btn--danger cp-btn--sm"
                        type="button"
                        disabled={busyKey === `unapprove:${f.user_id}`}
                        onClick={() => {
                          if (!window.confirm(`Un-approve ${f.parent_name}? They will go back to the pending queue and be removed from all of their groups.`)) return;
                          run(
                            `unapprove:${f.user_id}`,
                            () => unapproveMember(f.user_id),
                            `${f.parent_name} is back in the pending queue and out of their groups.`,
                          );
                        }}
                      >
                        {busyKey === `unapprove:${f.user_id}` ? 'Un-approving…' : 'Un-approve'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* ------------------------------------------------------ groups -- */}
      <h3 className="cp-h3 cp-h3--section">Groups</h3>
      {showEmptyStates && data.groups.length === 0 && (
        <div className="cp-empty">
          <p>No groups yet.</p>
        </div>
      )}
      {data.groups.map((g) => {
        const open = openGroups.has(g.id);
        const memberCount = g.members.length;
        return (
          <div className="cp-group" key={g.id}>
            <div className="cp-group-head">
              <h4 className="cp-h4">{g.name}</h4>
              <p className="cp-item-meta">{g.area_label} · {summarizeSchedule(g)}</p>
              <p className="cp-item-meta">
                {memberCount === 1 ? '1 family' : `${memberCount} families`}
              </p>
            </div>
            <button className="cp-btn cp-btn--quiet" type="button" onClick={() => toggleGroup(g.id)}>
              {open ? 'Hide members' : 'Show members'}
            </button>
            {open && (
              memberCount === 0 ? (
                <div className="cp-empty">
                  <p>No families in this group.</p>
                </div>
              ) : (
                <ul className="carpool-nearby-list">
                  {g.members.map((m) => {
                    const memberFamily = familyByUser.get(m.user_id);
                    const memberName = memberFamily?.parent_name ?? 'a family that has left';
                    return (
                      <li key={m.user_id}>
                        <p className="cp-item-name">{memberName}</p>
                        {memberFamily && <p className="cp-item-meta">{memberFamily.child_names}</p>}
                        <div className="cp-item-actions">
                          <button
                            className="cp-btn cp-btn--danger cp-btn--sm"
                            type="button"
                            disabled={busyKey === `removeMember:${g.id}:${m.user_id}`}
                            onClick={() => {
                              const who = memberFamily?.parent_name ?? 'this family';
                              if (!window.confirm(`Remove ${who} from ${g.name}? They will no longer see this group's contact details.`)) return;
                              run(
                                `removeMember:${g.id}:${m.user_id}`,
                                () => removeFromGroup(g.id, m.user_id),
                                `${who} was removed from ${g.name}.`,
                              );
                            }}
                          >
                            {busyKey === `removeMember:${g.id}:${m.user_id}` ? 'Removing…' : 'Remove from group'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            )}
            <div className="cp-actions">
              <button
                className="cp-btn cp-btn--danger cp-btn--sm"
                type="button"
                disabled={busyKey === `deleteGroup:${g.id}`}
                onClick={() => {
                  if (!window.confirm(`Delete ${g.name}? The group will be removed for everyone in it. The families themselves are not affected.`)) return;
                  run(
                    `deleteGroup:${g.id}`,
                    () => deleteGroup(g.id),
                    `${g.name} was deleted.`,
                  );
                }}
              >
                {busyKey === `deleteGroup:${g.id}` ? 'Deleting…' : 'Delete group'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
