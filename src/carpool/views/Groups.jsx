import { useCallback, useEffect, useRef, useState } from 'react';
import {
  rankGroups,
  summarizeSchedule,
  buildGroupRecord,
  fetchGroups,
  fetchMyMemberships,
  fetchMyRequests,
  fetchPendingRequesters,
  fetchRoster,
  createGroup,
  seedOwnMembership,
  requestToJoin,
  decideRequest,
  leaveGroup,
} from '../groups.js';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

const EMPTY = {
  groups: [],
  myGroups: [],
  organizedGroups: [],
  orphanGroups: [],
  pendingSent: [],
  nearby: [],
  rosters: {},
  requesters: {},
};

export default function Groups({ family, userId }) {
  // family.user_id is the same person as userId; userId is passed in
  // separately because Ready already holds it and every fetcher here returns
  // an empty list for a missing user, which would otherwise be
  // indistinguishable from a parent who genuinely has no groups yet.
  const me = userId ?? family?.user_id ?? null;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Bumped on every entry to load(). A load only writes state if its own
  // sequence number is still the newest, so a slow earlier fetch can never
  // land on top of a newer one and resurrect a group the parent just left.
  const loadSeqRef = useRef(0);

  // Mirrors busyKey. State updates are async, so two clicks inside one tick
  // would both read an empty busyKey; the ref is what actually gates them.
  const busyRef = useRef('');

  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [data, setData] = useState(EMPTY);
  // We should always be handed a signed-in user. If we somehow are not, the
  // view below would sit on "Loading your groups…" with no way out, so give
  // that wait a terminal state instead of an endless spinner.
  const [identityStalled, setIdentityStalled] = useState(false);

  // Create-a-group form.
  const [name, setName] = useState('');
  const [direction, setDirection] = useState(family?.direction ?? 'both');
  const [weekdays, setWeekdays] = useState(
    Array.isArray(family?.weekdays) && family.weekdays.length ? family.weekdays : [...WEEKDAYS],
  );
  const [meetingPoint, setMeetingPoint] = useState('');

  // One refetch routine for the whole view. Every action calls it when it
  // finishes, succeed or fail, so a button never sits disabled on a state the
  // database has already moved past (an accept that lost a race, a requester
  // an admin un-approved in the meantime).
  //
  // This never throws. Callers run it inside a finally block, where a throw
  // would replace the real error the parent needs to read.
  const load = useCallback(async () => {
    if (!me) return;
    const seq = ++loadSeqRef.current;
    const current = () => mountedRef.current && seq === loadSeqRef.current;
    try {
      const [allGroups, memberships, myRequests] = await Promise.all([
        fetchGroups(),
        fetchMyMemberships(me),
        fetchMyRequests(me),
      ]);

      const memberIds = new Set(memberships.map((m) => m.group_id));
      const myGroups = allGroups.filter((g) => memberIds.has(g.id));
      // Every group I created, whether or not my own membership row landed.
      const organizedGroups = allGroups.filter((g) => g.created_by === me);
      // A group I created that I am not in: createGroup's second write failed.
      const orphanGroups = organizedGroups.filter((g) => !memberIds.has(g.id));

      // fetchMyRequests returns decided rows too. Only a 'pending' row means
      // the organizer still has something to answer; an 'accepted' row is
      // already reflected in memberships, and a 'declined' one must leave the
      // group re-requestable, because request_to_join clears the old row and
      // files a fresh one.
      const pendingRequestGroupIds = new Set(
        myRequests.filter((r) => r.status === 'pending').map((r) => r.group_id),
      );

      const [rosterPairs, requesterPairs] = await Promise.all([
        Promise.all(myGroups.map(async (g) => [g.id, await fetchRoster(g.id)])),
        Promise.all(organizedGroups.map(async (g) => [g.id, await fetchPendingRequesters(g.id)])),
      ]);

      // rankGroups measures against family.area_lat/area_lng, so it is only
      // ever called from a branch where family exists.
      // A group I created is never a group I can ask to join. Without the
      // created_by test an orphan group would show up here with a "Request to
      // join" button, and a request filed against your own group can never be
      // accepted, because the accept controls only render for groups you are
      // already a member of.
      const nearby = rankGroups(
        family,
        allGroups.filter(
          (g) => !memberIds.has(g.id) && !pendingRequestGroupIds.has(g.id) && g.created_by !== me,
        ),
      );

      if (!current()) return;
      setData({
        groups: allGroups,
        myGroups,
        organizedGroups,
        orphanGroups,
        pendingSent: allGroups.filter((g) => pendingRequestGroupIds.has(g.id)),
        nearby,
        rosters: Object.fromEntries(rosterPairs),
        requesters: Object.fromEntries(requesterPairs),
      });
      setLoadError('');
      setLoaded(true);
    } catch (e) {
      // Drop everything we were showing. A refetch that fails right after a
      // leave would otherwise keep the old roster on screen, so the parent
      // would still be reading names, emails, and phone numbers for a group
      // they are no longer in. Showing nothing is the safe direction here.
      if (current()) {
        setData(EMPTY);
        setLoaded(false);
        setLoadError(e?.message || 'Could not load groups.');
      }
    } finally {
      if (current()) setLoading(false);
    }
  }, [me, family]);

  useEffect(() => {
    if (!me) return;
    setLoading(true);
    load();
  }, [me, load]);

  useEffect(() => {
    if (me) {
      setIdentityStalled(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      if (mountedRef.current) setIdentityStalled(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [me]);

  // Every write goes through here. supabase-js rethrows non auth errors such
  // as TypeError: Failed to fetch, so the try/catch/finally is what keeps a
  // button from staying disabled forever.
  async function run(key, work, successMessage) {
    // One write at a time for the whole view. busyKey is a single slot, so
    // letting a second action start would hand the first one's finally block
    // the job of clearing the second one's busy state, re-enabling a button
    // whose write is still in flight.
    if (busyRef.current) return;
    busyRef.current = key;
    setBusyKey(key);
    setActionError('');
    setNotice('');
    try {
      await work();
      if (mountedRef.current && successMessage) setNotice(successMessage);
    } catch (e) {
      if (mountedRef.current) setActionError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      // Free the button before refetching. supabase-js sets no request
      // timeout, so a fetch that never settles would otherwise leave every
      // control disabled with nothing on screen explaining why.
      busyRef.current = '';
      if (mountedRef.current) setBusyKey('');
      await load();
    }
  }

  function toggleWeekday(day) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function handleCreate(event) {
    event.preventDefault();
    run(
      'create',
      async () => {
        // buildGroupRecord throws synchronously on bad input. It is inside the
        // same try so a validation message lands in the same place as a
        // database message, including the trigger's "Add your family before
        // creating a group".
        const record = buildGroupRecord({
          userId: me,
          name,
          direction,
          weekdays: WEEKDAYS.filter((d) => weekdays.includes(d)),
          meetingPoint,
        });
        await createGroup(record);
        if (mountedRef.current) {
          setName('');
          setMeetingPoint('');
        }
      },
      'Your group is created. You are the first member.',
    );
  }

  if (!me) {
    // Never say "you are not in any groups" before we know who you are.
    return (
      <section>
        <h2>Carpool groups</h2>
        {identityStalled ? (
          <p role="alert">
            We could not confirm your sign in, so your groups did not load. Please refresh the page.
            If that does not work, sign out and sign back in.
          </p>
        ) : (
          <p>Loading your groups…</p>
        )}
      </section>
    );
  }

  const showEmptyStates = loaded && !loading;

  return (
    <section>
      <h2>Carpool groups</h2>
      <p>
        A group is a small set of families sharing rides. When you join one, your name, your
        children's names, your general area, your schedule, your email, and your phone become
        visible to the other families in that group. Nothing outside the group changes.
      </p>

      {loading && <p>Loading your groups…</p>}
      {loadError && (
        <p role="alert">
          Could not load groups: {loadError}{' '}
          <button type="button" onClick={() => { setLoading(true); load(); }}>Try again</button>
        </p>
      )}
      {actionError && <p role="alert">{actionError}</p>}
      {notice && <p role="status">{notice}</p>}

      {/* A group whose creator never got their own membership row. The fix is
          always to retry the membership, never to create the group again. */}
      {data.orphanGroups.length > 0 && (
        <div>
          <h3>Finish setting up</h3>
          {data.orphanGroups.map((g) => {
            // Families can already be asking to join a group you have not
            // finished setting up. The accept and decline controls live inside
            // My groups, so say how many are waiting rather than let them sit
            // somewhere this parent cannot see.
            const waiting = (data.requesters[g.id] ?? []).length;
            return (
            <div key={g.id}>
              <p>
                <strong>{g.name}</strong> was created, but you were not added to it. Add yourself to
                finish. Please do not create the group again.
              </p>
              {waiting > 0 && (
                <p>
                  {waiting === 1
                    ? '1 family is already asking to join.'
                    : `${waiting} families are already asking to join.`}{' '}
                  You can answer once you have added yourself.
                </p>
              )}
              <button
                type="button"
                disabled={busyKey === `seed:${g.id}`}
                onClick={() => run(`seed:${g.id}`, () => seedOwnMembership(g.id, me), `You are now in ${g.name}.`)}
              >
                {busyKey === `seed:${g.id}` ? 'Adding…' : 'Add me to this group'}
              </button>
            </div>
            );
          })}
        </div>
      )}

      <h3>My groups</h3>
      {showEmptyStates && data.myGroups.length === 0 && (
        <p>You are not in a group yet. Ask to join one below, or start your own.</p>
      )}
      {data.myGroups.map((g) => {
        const roster = data.rosters[g.id] ?? [];
        const requesters = data.requesters[g.id] ?? [];
        const isOrganizer = g.created_by === me;
        return (
          <div key={g.id}>
            <h4>{g.name}{isOrganizer ? ' (you organize this)' : ''}</h4>
            <p>{g.area_label} · {summarizeSchedule(g)}</p>
            {g.meeting_point && <p>Meeting point: {g.meeting_point}</p>}

            <p><strong>Families in this group</strong></p>
            {roster.length === 0 ? (
              <p>No members loaded yet.</p>
            ) : (
              <ul className="carpool-nearby-list">
                {roster.map((m) => (
                  <li key={m.user_id}>
                    <strong>{m.parent_name}</strong>, {m.child_names}
                    <br />
                    {m.area_label} · {summarizeSchedule(m)}
                    <br />
                    {m.contact_email && <a href={`mailto:${m.contact_email}`}>{m.contact_email}</a>}
                    {m.contact_email && m.contact_phone ? ' · ' : ''}
                    {m.contact_phone && <a href={`tel:${m.contact_phone}`}>{m.contact_phone}</a>}
                  </li>
                ))}
              </ul>
            )}

            {isOrganizer && (
              <div>
                <p><strong>Families asking to join</strong></p>
                {requesters.length === 0 ? (
                  <p>No one is waiting right now.</p>
                ) : (
                  <ul className="carpool-nearby-list">
                    {/* pending_requesters carries no contact columns on
                        purpose. Contact details unlock only after an accept. */}
                    {requesters.map((r) => (
                      <li key={r.request_id}>
                        <strong>{r.parent_name}</strong>, {r.child_names}
                        <br />
                        {r.area_label} · {summarizeSchedule(r)}
                        <br />
                        <button
                          type="button"
                          disabled={busyKey === `accept:${r.request_id}`}
                          onClick={() => run(
                            `accept:${r.request_id}`,
                            () => decideRequest({ requestId: r.request_id, accept: true }),
                            `${r.parent_name} is now in ${g.name}. You can both see each other's contact details.`,
                          )}
                        >
                          {busyKey === `accept:${r.request_id}` ? 'Accepting…' : 'Accept'}
                        </button>{' '}
                        <button
                          type="button"
                          disabled={busyKey === `decline:${r.request_id}`}
                          onClick={() => run(
                            `decline:${r.request_id}`,
                            () => decideRequest({ requestId: r.request_id, accept: false }),
                            `You declined the request from ${r.parent_name}. No contact details were shared.`,
                          )}
                        >
                          {busyKey === `decline:${r.request_id}` ? 'Declining…' : 'Decline'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={busyKey === `leave:${g.id}`}
              onClick={() => {
                if (!window.confirm(`Leave ${g.name}? The other families will no longer see your contact details.`)) return;
                run(`leave:${g.id}`, () => leaveGroup(g.id, me), `You left ${g.name}.`);
              }}
            >
              {busyKey === `leave:${g.id}` ? 'Leaving…' : 'Leave group'}
            </button>
          </div>
        );
      })}

      {data.pendingSent.length > 0 && (
        <div>
          <h3>Requests you sent</h3>
          <ul className="carpool-nearby-list">
            {data.pendingSent.map((g) => (
              <li key={g.id}>
                <strong>{g.name}</strong> · {g.area_label}
                <br />
                Request sent. The organizer can see your name, your children's names, your general
                area, and your schedule while they decide. Your email and phone stay private unless
                they accept.
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3>Groups near you</h3>
      {showEmptyStates && data.nearby.length === 0 && (
        <p>No other groups to join right now. You can start one below.</p>
      )}
      {data.nearby.length > 0 && (
        <ul className="carpool-nearby-list">
          {data.nearby.map((g) => (
            <li key={g.id}>
              <strong>{g.name}</strong>
              <br />
              {g.area_label} · {summarizeSchedule(g)} · {g.distanceMiles.toFixed(1)} mi
              {g.meeting_point && <><br />Meeting point: {g.meeting_point}</>}
              <br />
              <small>
                Asking to join shows this organizer your name, your children's names, your general
                area, and your schedule right away. Your email and phone are shared only if they
                accept.
              </small>
              <br />
              <button
                type="button"
                disabled={busyKey === `request:${g.id}`}
                onClick={() => run(
                  `request:${g.id}`,
                  () => requestToJoin(g.id),
                  `Your request to join ${g.name} is on its way to the organizer.`,
                )}
              >
                {busyKey === `request:${g.id}` ? 'Sending…' : 'Request to join'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3>Start a group</h3>
      <p>
        Your group uses the general area you already gave us, never your street address. You become
        its first member and you decide who joins.
      </p>
      <form onSubmit={handleCreate}>
        <p>
          <label htmlFor="group-name">Group name</label>
          <br />
          <input
            id="group-name"
            type="text"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Morning riders, west side"
          />
        </p>

        <p>
          <label htmlFor="group-direction">Rides needed</label>
          <br />
          <select id="group-direction" value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="both">Morning and afternoon</option>
            <option value="am">Morning</option>
            <option value="pm">Afternoon</option>
          </select>
        </p>

        <fieldset>
          <legend>Days</legend>
          {WEEKDAYS.map((day) => (
            <label key={day} htmlFor={`group-day-${day}`} style={{ marginRight: '0.75rem' }}>
              <input
                id={`group-day-${day}`}
                type="checkbox"
                checked={weekdays.includes(day)}
                onChange={() => toggleWeekday(day)}
              />{' '}
              {day}
            </label>
          ))}
        </fieldset>

        <p>
          <label htmlFor="group-meeting">Meeting point (optional)</label>
          <br />
          <input
            id="group-meeting"
            type="text"
            value={meetingPoint}
            onChange={(e) => setMeetingPoint(e.target.value)}
            placeholder="A public spot such as a library lot"
          />
          <br />
          <small>Pick somewhere public. Please do not put a home address here.</small>
        </p>

        <button type="submit" disabled={busyKey === 'create'}>
          {busyKey === 'create' ? 'Creating…' : 'Create group'}
        </button>
      </form>
    </section>
  );
}
