// ---------------------------------------------------------------------------
// Turning a holder's standing availability into concrete dates a parent can
// tap. The holder answers once ("Tuesdays and Thursdays, afternoon carline")
// and every requester after that just picks a day.
//
// Pure functions — no Supabase, no Date.now() baked in, so it all unit tests.
// ---------------------------------------------------------------------------

export const WEEKDAYS = [
  { n: 1, short: 'Mon', label: 'Monday' },
  { n: 2, short: 'Tue', label: 'Tuesday' },
  { n: 3, short: 'Wed', label: 'Wednesday' },
  { n: 4, short: 'Thu', label: 'Thursday' },
  { n: 5, short: 'Fri', label: 'Friday' },
];

export const SLOT_LABEL = { am: 'morning carline', pm: 'afternoon carline' };

// Handoffs happen at morning carline. Afternoon pickup is chaos — everyone
// leaving at once, nobody able to stop. Anything else is a special
// arrangement the two families make between themselves.
export const MORNING_ONLY = true;

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Dates only — no times, no timezone math to get wrong. "Tomorrow" is the
// earliest offer, so nobody is asked to make a handoff happen in an hour.
export function nextSlots(bin, from = new Date(), count = 4) {
  if (!bin || bin.offers_carline === false) return [];
  const days = (bin.carline_days && bin.carline_days.length ? bin.carline_days : [1, 2, 3, 4, 5])
    .filter((d) => d >= 1 && d <= 5);
  if (!days.length) return [];

  const when = MORNING_ONLY ? 'am' : (bin.carline_when || 'am');
  const slots = when === 'both' ? ['am', 'pm'] : [when];

  const out = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  cur.setDate(cur.getDate() + 1); // start tomorrow

  for (let i = 0; i < 21 && out.length < count; i++) {
    const dow = cur.getDay() === 0 ? 7 : cur.getDay();
    if (days.includes(dow)) {
      for (const s of slots) {
        if (out.length < count) out.push({ date: iso(cur), slot: s, dow });
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// "Tue, Aug 4 · afternoon carline"
export function slotLabel(slot) {
  if (!slot) return '';
  const [y, m, d] = slot.date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${SLOT_LABEL[slot.slot] || ''}`.trim();
}

// What a scheduled request says on screen.
export function handoffSummary(req) {
  if (!req || !req.handoff_mode) return '';
  if (req.handoff_mode === 'student') return 'Student to student';
  if (req.handoff_mode === 'desk') return 'RCA front desk';
  if (!req.handoff_date) return 'Carline — day to be picked';
  return slotLabel({ date: req.handoff_date, slot: req.handoff_slot });
}

// A holder's availability in one human line, for their bin page.
export function availabilityLine(bin) {
  if (!bin) return '';
  const parts = [];
  if (bin.offers_carline !== false) {
    const days = (bin.carline_days && bin.carline_days.length ? bin.carline_days : [1, 2, 3, 4, 5])
      .slice().sort()
      .map((n) => WEEKDAYS.find((w) => w.n === n)?.short)
      .filter(Boolean);
    const when = MORNING_ONLY ? 'mornings'
      : bin.carline_when === 'both' ? 'morning & afternoon'
      : bin.carline_when === 'am' ? 'mornings' : 'afternoons';
    if (days.length === 5) parts.push(`Carline any weekday, ${when}`);
    else if (days.length) parts.push(`Carline ${days.join(' · ')}, ${when}`);
  }
  if (bin.offers_student !== false) parts.push('Student to student');
  return parts.length ? parts.join('  ·  ') : 'No handoff options set yet';
}

// The line at the top of someone's requests page. Telling a family to "pick a
// handoff" when everything they have is still on the waitlist is just noise —
// so say the thing that's actually true of their list right now.
export function myRequestsLead(rows) {
  const has = (s) => (rows || []).some((r) => r.status === s);
  const waiting = has('open');
  const ready = has('assigned');
  const inFlight = has('scheduled') || has('handed_off');

  if (ready) {
    return waiting
      ? 'One of yours is here — pick a handoff that fits your week. We’ll text you about the rest when they turn up.'
      : 'Your item is here. Pick a handoff that fits your week, then tap Got it once it’s in your hands.';
  }
  if (inFlight) {
    return 'A handoff is set. Tap Got it once it’s in your hands — that’s what closes it out.';
  }
  if (waiting) {
    return 'You’re on the waitlist. The moment a match comes into any bin we’ll text you, and you can pick a handoff then.';
  }
  return 'Nothing needs you right now.';
}
