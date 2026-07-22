import React, { useEffect, useRef, useState } from 'react';
import { loadPlaces, loadGeocoding } from '../maps.js';

const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' },
];

// Autocomplete tuning. 250ms debounce keeps us under Google's rate ceiling
// without feeling laggy; 3 chars is the floor below which predictions are
// noise (and each request still bills).
const DEBOUNCE_MS = 250;
const MIN_CHARS = 3;

export default function FamilyForm({ family, initialEmail, submitLabel, heading, onSubmitData }) {
  // The address field is OUR OWN input + suggestion list built on the Places
  // Autocomplete Data API (AutocompleteSuggestion.fetchAutocompleteSuggestions),
  // NOT Google's PlaceAutocompleteElement widget. The widget was tried and
  // shipped first: on phones it enters a built-in fullscreen mode where the
  // suggestion list covers the entire viewport with its own back arrow,
  // hiding the form. No documented option disables it and its shadow root is
  // closed. Keeping Google's data and owning the UI fixes that, and also lets
  // the input be properly labelled (the widget's internal input could not be).

  // Holds the address the user actually SELECTED from autocomplete:
  // { formattedAddress, lat, lng, postalCode }. Null until a valid pick.
  // Security invariant (six review rounds sit behind this): it is set in
  // exactly one place — pickSuggestion, after fetchFields succeeds — and any
  // edit to the input clears it, so a typed-but-not-picked address can never
  // be saved with someone else's coordinates.
  const selectedPlaceRef = useRef(
    family ? { formattedAddress: family.address, lat: family.lat, lng: family.lng, postalCode: family.area_label } : null
  );

  // Places Autocomplete session token. One session = N suggestion fetches +
  // one Place details fetch, billed as a unit. Created lazily on the first
  // fetch, cleared after a successful fetchFields so the NEXT keystroke run
  // starts a fresh session (reusing a consumed token bills every request
  // individually). Kept on fetchFields failure — the session is still open.
  const sessionTokenRef = useRef(null);

  // Monotonic sequence for suggestion fetches. A response only lands if its
  // sequence still matches; anything else is stale (a slow response arriving
  // after a newer keystroke, after the field was cleared below MIN_CHARS,
  // after a pick, or after unmount must not repopulate the list).
  const fetchSeqRef = useRef(0);
  const debounceRef = useRef(null);

  const [parentName, setParentName] = useState(family?.parent_name ?? '');
  const [childNames, setChildNames] = useState(family?.child_names ?? '');
  // The text in the address input. Controlled — we own it now, which is what
  // makes selection invalidation on edit direct instead of best-effort.
  const [addressInput, setAddressInput] = useState(family?.address ?? '');
  // Mirrors the currently CONFIRMED (selected) address for display only
  // (the "Confirmed:" line under the field).
  const [addressText, setAddressText] = useState(family?.address ?? '');
  const [suggestions, setSuggestions] = useState([]); // [{ prediction, full, main, secondary }]
  const [listOpen, setListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1); // keyboard highlight; -1 = none
  const [direction, setDirection] = useState(family?.direction ?? 'both');
  const [weekdays, setWeekdays] = useState(family?.weekdays ?? ['mon', 'tue', 'wed', 'thu', 'fri']);
  const [contactPhone, setContactPhone] = useState(family?.contact_phone ?? '');
  const [contactEmail, setContactEmail] = useState(family?.contact_email ?? initialEmail ?? '');
  const [status, setStatus] = useState('idle'); // idle | saving | error
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      // Invalidate any in-flight fetch and pending debounce on unmount.
      fetchSeqRef.current += 1;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function closeList() {
    setSuggestions([]);
    setListOpen(false);
    setActiveIndex(-1);
  }

  async function fetchSuggestions(input) {
    const seq = ++fetchSeqRef.current;
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await loadPlaces();
      if (!sessionTokenRef.current) sessionTokenRef.current = new AutocompleteSessionToken();
      // No includedPrimaryTypes on purpose: with no type filter the Data API
      // returns establishments (churches, schools, stores) alongside street
      // addresses, which is what lets a parent pin a nearby landmark instead
      // of their home (Mose, 2026-07-21). Do not add a type restriction here.
      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionTokenRef.current,
        region: 'us',
      });
      if (seq !== fetchSeqRef.current) return; // stale — a newer keystroke owns the list
      const items = (results ?? [])
        .filter((s) => s.placePrediction)
        .map((s) => {
          const p = s.placePrediction;
          // mainText/secondaryText are FormattableText objects (verified at
          // runtime); .text is the always-present fallback.
          const full = p.text?.toString() ?? '';
          return {
            prediction: p,
            full,
            main: p.mainText?.toString() || full,
            secondary: p.secondaryText?.toString() || '',
          };
        });
      setSuggestions(items);
      setListOpen(items.length > 0);
      setActiveIndex(-1);
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      closeList();
      // Surface API/network failures in the existing error slot — never a
      // white screen, never silence.
      setError('Address lookup is unavailable right now. Please try again in a moment.');
    }
  }

  function handleAddressChange(e) {
    const value = e.target.value;
    setAddressInput(value);
    // EVERY edit bumps the sequence, unconditionally and synchronously. This
    // is what invalidates a pickSuggestion whose fetchFields is still in
    // flight: during that window selectedPlaceRef is still null, so the clear
    // below does nothing, and without this bump the late resolution would
    // write the abandoned pick's coordinates over the user's edit (review
    // finding, 2026-07-19). The debounced fetch bumps again when it runs.
    fetchSeqRef.current += 1;
    // ANY edit invalidates a previous pick. Direct, not best-effort: we own
    // onChange, so there is no widget event that can fail to fire.
    if (selectedPlaceRef.current) {
      selectedPlaceRef.current = null;
      setAddressText('');
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (trimmed.length < MIN_CHARS) {
      closeList();
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(trimmed), DEBOUNCE_MS);
  }

  async function pickSuggestion(item) {
    // A pick ends the current suggestion cycle: cancel pending/in-flight
    // fetches so a slow response can't reopen the list over the confirmation.
    fetchSeqRef.current += 1;
    // Capture our claim on the sequence. If the user edits the input while
    // fetchFields is in flight, handleAddressChange bumps the sequence and
    // this pick is abandoned: the edit wins, not the network.
    const seq = fetchSeqRef.current;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    closeList();
    setAddressInput(item.full);
    try {
      const place = item.prediction.toPlace();
      // The session token is attached to the Place by the prediction; this
      // details call closes the billing session.
      await place.fetchFields({ fields: ['formattedAddress', 'location', 'addressComponents'] });
      // The session is consumed by a successful details call whether or not
      // this pick still stands; keep the null before the staleness return or
      // the next keystroke run reuses a spent token and bills per request.
      sessionTokenRef.current = null;
      if (seq !== fetchSeqRef.current) return; // user edited mid-fetch — abandoned
      const postalCode = place.addressComponents
        ?.find((c) => c.types.includes('postal_code'))
        ?.longText ?? null;
      selectedPlaceRef.current = {
        formattedAddress: place.formattedAddress ?? '',
        lat: place.location ? place.location.lat() : null,
        lng: place.location ? place.location.lng() : null,
        postalCode,
      };
      setAddressText(place.formattedAddress ?? '');
      setError('');
    } catch (err) {
      if (seq !== fetchSeqRef.current) return; // abandoned pick; the edit owns the field now
      selectedPlaceRef.current = null;
      setError(err.message ?? 'Could not read that address. Please try selecting it again.');
    }
  }

  function handleAddressKeyDown(e) {
    if (e.key === 'ArrowDown') {
      if (suggestions.length > 0) {
        e.preventDefault();
        setListOpen(true);
        setActiveIndex((i) => (i + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      if (suggestions.length > 0) {
        e.preventDefault();
        setListOpen(true);
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      }
    } else if (e.key === 'Enter') {
      // Only intercept Enter when an option is highlighted; otherwise let the
      // form submit (and the "pick from suggestions" check explain itself).
      if (listOpen && activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        pickSuggestion(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      if (listOpen) {
        e.preventDefault();
        closeList();
      }
    }
  }

  function toggleDay(key) {
    setWeekdays((cur) => (cur.includes(key) ? cur.filter((d) => d !== key) : [...cur, key]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    // The old widget needed a submit-time display-text comparison as
    // defense-in-depth against its 'input' event not firing. With a
    // controlled input, handleAddressChange clears the selection on any edit
    // directly, so the only submit-time checks needed are: a live selection
    // exists, and it carries a postal code.
    const place = selectedPlaceRef.current;
    if (!place) {
      setError('Please pick your address from the suggestions so we can locate your area.');
      return;
    }
    if (!place.postalCode) {
      setError("That address didn't include a ZIP code. Please pick a more specific address.");
      return;
    }
    setStatus('saving');
    try {
      // Derive the zip centroid (the only location shown to others) by geocoding the postal code.
      const { Geocoder } = await loadGeocoding();
      const geocoder = new Geocoder();
      const { results } = await geocoder.geocode({ address: place.postalCode });
      if (!results || !results[0]) throw new Error('Could not locate that postal code.');
      const loc = results[0].geometry.location;
      const areaGeocode = { lat: loc.lat(), lng: loc.lng(), label: place.postalCode };

      const payload = {
        parentName, childNames, place, areaGeocode,
        direction, weekdays, contactPhone, contactEmail,
      };
      await onSubmitData(payload);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err.message ?? 'Could not save. Please try again.');
    }
  }

  return (
    <form className="carpool-shell" onSubmit={handleSubmit}>
      <h2 className="cp-h2">{heading ?? (family ? 'Edit your family' : 'Add your family')}</h2>

      <div className="cp-field">
        <label className="cp-field-label" htmlFor="family-parent-name">Your name</label>
        <input id="family-parent-name" required value={parentName} onChange={(e) => setParentName(e.target.value)} />
      </div>

      <div className="cp-field">
        <label className="cp-field-label" htmlFor="family-child-names">Child name(s)</label>
        <input id="family-child-names" required value={childNames} onChange={(e) => setChildNames(e.target.value)} placeholder="e.g. Jordan, Riley" />
      </div>

      <div className="cp-field">
        {/* A real label at last: the old Google widget hid its input inside a
            closed shadow root, so the field could only be named via aria-label
            on a role="group" container. Our own input takes htmlFor. */}
        <label className="cp-field-label" htmlFor="family-address">A spot near you</label>
        {/* Above the field, not below it, at Mose's direction: a parent
            should know why this is asked for BEFORE they type it, not discover
            the explanation as fine print afterward.
            Reframed 2026-07-21: a parent said "never shared" was not enough,
            he would rather not type his home in at all. Since we only ever use
            and show the general AREA, a nearby landmark in the same area gives
            the identical result, so we bless that outright instead of arguing
            the home address is safe. The autocomplete is set to return places
            (churches, schools, stores), not just street addresses, so this
            copy is actually actionable. */}
        <div className="cp-consent cp-consent--inline">
          <p>Pick a place to put you on the map by area. Your home works, and we only ever use and show your general area, never your address. If you would rather not enter your home, pick a nearby place you trust instead, like a church, a school, or a store. Families only ever see your general area. <a href="#sharing">How sharing works</a></p>
        </div>
        <div className="cp-place">
          <input
            id="family-address"
            type="text"
            role="combobox"
            aria-expanded={listOpen}
            aria-controls="family-address-listbox"
            aria-activedescendant={activeIndex >= 0 ? `family-address-option-${activeIndex}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            value={addressInput}
            onChange={handleAddressChange}
            onKeyDown={handleAddressKeyDown}
            onBlur={closeList}
            /* Load-bearing, not decoration: typing an address is not enough,
               you have to PICK a suggestion or handleSubmit rejects the form
               (no lat/lng is ever populated otherwise). The instruction that
               a suggestion must be picked stays visible here. */
            placeholder="Type an address or a place, then pick it"
          />
          {listOpen && (
            <div className="cp-place-pop">
              <ul className="cp-place-list" role="listbox" id="family-address-listbox" aria-label="Address suggestions">
                {suggestions.map((s, i) => (
                  <li
                    key={s.prediction.placeId ?? s.full + i}
                    id={`family-address-option-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    className={`cp-place-opt${i === activeIndex ? ' cp-place-opt--active' : ''}`}
                    /* Select on mousedown, not click: mousedown fires BEFORE
                       the input's blur (which closes the list), so acting here
                       beats the race outright — on touch too, where the
                       compatibility mousedown precedes blur the same way.
                       preventDefault keeps focus on the input as a bonus. */
                    onMouseDown={(ev) => { ev.preventDefault(); pickSuggestion(s); }}
                  >
                    <span className="cp-place-main">{s.main}</span>
                    {s.secondary && <span className="cp-place-secondary">{s.secondary}</span>}
                  </li>
                ))}
              </ul>
              {/* Required by Google's Places terms when predictions are shown
                  without a Google map: attribution must accompany the list. */}
              <div className="cp-place-attrib">powered by Google</div>
            </div>
          )}
        </div>
        {addressText && <p className="cp-confirmed">Confirmed: {addressText}</p>}
      </div>

      <fieldset>
        <legend>When do you need carpool?</legend>
        {/* Stacked, not wrapped: these three are one mutually exclusive set,
            and their labels differ enough in width that wrapping them leaves
            a ragged two-then-one shape that reads as a layout accident. */}
        <div className="cp-choices cp-choices--stack">
          {['am', 'pm', 'both'].map((d) => (
            <label className="cp-choice" key={d}>
              <input type="radio" name="direction" value={d} checked={direction === d} onChange={() => setDirection(d)} />
              {d === 'am' ? 'Morning drop-off' : d === 'pm' ? 'Afternoon pickup' : 'Both'}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Which days?</legend>
        <div className="cp-choices">
          {DAYS.map((d) => (
            <label className="cp-choice" key={d.key}>
              <input type="checkbox" checked={weekdays.includes(d.key)} onChange={() => toggleDay(d.key)} />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="cp-field">
        <label className="cp-field-label" htmlFor="family-phone">Phone (optional)</label>
        <input id="family-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
      </div>
      <div className="cp-field">
        <label className="cp-field-label" htmlFor="family-email">Contact email</label>
        <input id="family-email" type="email" required value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
      </div>

      {error && <p role="alert">{error}</p>}
      <button className="cp-btn cp-btn--primary cp-btn--block" type="submit" disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving…' : submitLabel ?? (family ? 'Save changes' : 'Add my family')}
        <span className="cp-arr" aria-hidden="true">→</span>
      </button>
    </form>
  );
}
