// Pure helpers for the "Getting started" handoff panel on each group. This file
// holds ALL the logic; the view (Groups.jsx) only wires these to the roster data
// it already has. Nothing here touches the network or the database: the handoff
// only makes what a member can already see in the roster actionable, so there is
// no new data exposure and nothing to fetch.
//
// The one genuinely fiddly part is the sms: scheme, whose shape diverges by
// platform. That divergence is isolated in groupTextHref and unit-tested on both
// branches, because it is the piece most likely to break silently on a real
// phone.

// iPhone / iPad / iPod are ios; anything reporting Android is android; every
// other agent (desktop, unknown) is other, which groupTextHref treats as ios
// because the iOS sms:/open form is the safest cross-platform default.
export function detectPlatform(userAgent) {
  const ua = userAgent ?? '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

// The starter text a parent sees pre-filled in Messages or the email body. Plain
// and warm, and editable by them once it opens. When no organizer name is known
// (the created_by member is not on the roster, or their name is blank) the
// "[name] set it up" sentence is dropped rather than left with an empty slot.
// Copy rules: no em dash, no hyphen break, no exclamation point.
export function starterMessage(organizerName) {
  const opener = 'Hi, this is our RCA carpool group from wearercap.';
  const closer = "Let's sort out who drives which days and a pickup time and spot.";
  const name = typeof organizerName === 'string' ? organizerName.trim() : '';
  return name ? `${opener} ${name} set it up. ${closer}` : `${opener} ${closer}`;
}

// Build the sms: deep link. Returns null when no member has a phone, which is
// the signal for the view to omit the text button entirely and lean on email.
//
// Platform divergence is real and is the whole reason this is a tested helper:
//   ios / other -> sms:/open?addresses=n1,n2&body=<encoded>   (ampersand)
//   android     -> sms:n1,n2?body=<encoded>                   (question mark)
// The body is always encodeURIComponent'd so an ampersand or question mark a
// parent's own text could never be, cannot be read as a URL delimiter and split
// the recipients off.
export function groupTextHref({ phones, message, platform }) {
  const list = Array.isArray(phones) ? phones : [];
  // Sanitize BEFORE the empty check and the join. contact_phone is free text the
  // parent typed with no mask on the form, so it arrives as "(404) 555-1212" or
  // "404.555.1212" or "+1 404 555 1212". Spaces and parens are not valid in an
  // sms: address list, and the comma-delimited recipient parser does not strip
  // them the way a single tel: dial does, so raw numbers open Messages with no
  // recipients or the wrong ones, silently. Keep only digits and a leading plus.
  // Anything that sanitizes to empty (a parent typed "n/a") is dropped, and if
  // that leaves nothing we return null so the button is omitted, same as no phone.
  const recipients = list
    .map((p) => String(p).replace(/[^\d+]/g, ''))
    .filter(Boolean)
    .join(',');
  if (!recipients) return null;
  const body = encodeURIComponent(message ?? '');
  if (platform === 'android') return `sms:${recipients}?body=${body}`;
  return `sms:/open?addresses=${recipients}&body=${body}`;
}

// Multi-recipient mailto is rock solid on every platform, so this is the
// guaranteed-working group action even for a group where nobody entered a phone.
// Returns null when there are no emails (email is required on every family, so in
// practice this is only the not-yet-loaded roster case).
export function groupEmailHref({ emails, subject, body }) {
  const list = Array.isArray(emails) ? emails : [];
  if (list.length === 0) return null;
  const recipients = list.join(',');
  const query = `subject=${encodeURIComponent(subject ?? '')}&body=${encodeURIComponent(body ?? '')}`;
  return `mailto:${recipients}?${query}`;
}
