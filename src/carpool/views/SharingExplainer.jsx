// The full "how sharing works" page, reachable from #sharing anywhere in the
// app (signed in or not). Mose's direction 2026-07-19: the inline consent
// blocks read as a barrier at the moment of joining, so the systemic detail
// lives here, warmly, and the decision points keep one short true line plus
// a link. The FACTS on this page went through the Phase 3A review rounds.
// Warm the tone all you like; do not make a claim on it less true.
export default function SharingExplainer({ onBack }) {
  return (
    <div className="carpool-shell">
      <button type="button" className="cp-btn cp-btn--quiet cp-backlink" onClick={onBack}>
        <span className="cp-arr">←</span> Back
      </button>
      <p className="cp-label cp-label--bar">Your family's info</p>
      <h1 className="cp-h1">How sharing <span className="cp-hl">works.</span></h1>
      <p>
        Carpool only works if a few families can reach each other. Here is
        exactly what is shared, when it is shared, and who sees it, in plain
        language.
      </p>

      <h3 className="cp-h3 cp-h3--section">Your address</h3>
      <p>
        Never shared. We use it once, to place your family in a general area
        like 30337. Other families only ever see that area. Your street
        address is not shown to anyone, including group members.
      </p>

      <h3 className="cp-h3 cp-h3--section">On the family map</h3>
      <p>
        Once your family is approved, other approved RCAP families can see
        your name, your children's names, your general area, and your
        schedule. That is what makes finding each other possible. Your email
        and phone are not part of the map.
      </p>

      <h3 className="cp-h3 cp-h3--section">When you ask to join a group</h3>
      <p>
        The group's organizer sees your name, your children's names, your
        general area, and your schedule while they decide. Your email and
        phone stay private unless they accept you. You can withdraw a request
        any time before it is answered, and asking again later is always
        allowed.
      </p>

      <h3 className="cp-h3 cp-h3--section">When you are in a group</h3>
      <p>
        Everyone in the group can see everyone else's name, children's names,
        general area, schedule, email, and phone. That is the point of a
        group: you are choosing a small set of families to actually plan
        rides with.
      </p>
      <p>
        Groups can grow. The organizer decides who joins after you, and each
        family they accept sees the same details you shared. You are not
        asked again each time, so joining a group means trusting its
        organizer with that call.
      </p>

      <h3 className="cp-h3 cp-h3--section">When you leave</h3>
      <p>
        Leaving a group ends the sharing from that moment on. New families
        who join afterward will not see your details. What someone already
        saw while you were in the group is out of our hands, the same as any
        contact you share with another parent.
      </p>

      <h3 className="cp-h3 cp-h3--section">Who runs this</h3>
      <p>
        Parent volunteers on the carpool committee approve new signups and
        can step in if something is wrong. They see what approved parents
        see, plus the signup queue. Questions or concerns reach a person at{' '}
        <a href="mailto:carpool@wearercap.org">carpool@wearercap.org</a>.
      </p>
      <p>
        RCAP Carpool is organized independently by parent volunteers. It is
        not sponsored by, run by, or affiliated with Ron Clark Academy. The
        school does not see this site's information and is not responsible
        for the carpools families arrange here.
      </p>
    </div>
  );
}
