import React, { useEffect, useRef, useState } from 'react';
import { loadPlaces, loadGeocoding } from '../maps.js';

const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' },
];

export default function FamilyForm({ family, initialEmail, submitLabel, onSubmitData }) {
  // Container the PlaceAutocompleteElement web component is mounted into.
  // (The legacy google.maps.places.Autocomplete bound to a plain <input> is
  // deprecated; the current widget is its own custom element, not something
  // you attach to an existing input — see task-4-report.md for the docs.)
  const addressContainerRef = useRef(null);

  // Holds the live PlaceAutocompleteElement instance so handleSubmit can
  // read its current text at submit time (defense-in-depth against a stale
  // selection when the 'input' listener below doesn't fire).
  const autocompleteElRef = useRef(null);

  // Holds the address the user actually SELECTED from autocomplete:
  // { formattedAddress, lat, lng, postalCode }. Null until a valid pick.
  const selectedPlaceRef = useRef(
    family ? { formattedAddress: family.address, lat: family.lat, lng: family.lng, postalCode: family.area_label } : null
  );

  // The text the WIDGET displayed at the moment of selection. This is the
  // prediction label (e.g. "1950 West Rugby Avenue, College Park, GA, USA"),
  // which deliberately differs from the Place's canonical formattedAddress
  // (e.g. "1950 W Rugby Ave, College Park, GA 30337, USA"). The submit-time
  // stale check must compare against THIS, not formattedAddress, or every
  // valid selection is rejected.
  const selectedDisplayRef = useRef(family ? family.address : null);

  const [parentName, setParentName] = useState(family?.parent_name ?? '');
  const [childNames, setChildNames] = useState(family?.child_names ?? '');
  // Mirrors the currently CONFIRMED (selected) address for display only.
  // The autocomplete widget owns its own internal input text; this is not
  // a controlled input value.
  const [addressText, setAddressText] = useState(family?.address ?? '');
  const [direction, setDirection] = useState(family?.direction ?? 'both');
  const [weekdays, setWeekdays] = useState(family?.weekdays ?? ['mon', 'tue', 'wed', 'thu', 'fri']);
  const [contactPhone, setContactPhone] = useState(family?.contact_phone ?? '');
  const [contactEmail, setContactEmail] = useState(family?.contact_email ?? initialEmail ?? '');
  const [status, setStatus] = useState('idle'); // idle | saving | error
  const [error, setError] = useState('');

  // Attach Google's PlaceAutocompleteElement (the current, non-deprecated
  // widget) to the container div. On a valid selection, fetch
  // formattedAddress + location + postal code and store them in
  // selectedPlaceRef; mirror the confirmed text into addressText.
  useEffect(() => {
    let cancelled = false;
    let autocompleteEl = null;
    let onSelect = null;
    let onInput = null;
    let onError = null;

    loadPlaces()
      .then(({ PlaceAutocompleteElement }) => {
        if (cancelled || !addressContainerRef.current) return;

        autocompleteEl = new PlaceAutocompleteElement();
        autocompleteEl.placeholder = 'Start typing and pick from the list';
        if (family?.address) autocompleteEl.value = family.address;
        addressContainerRef.current.appendChild(autocompleteEl);
        autocompleteElRef.current = autocompleteEl;

        onSelect = async (event) => {
          try {
            const place = event.placePrediction.toPlace();
            await place.fetchFields({ fields: ['formattedAddress', 'location', 'addressComponents'] });
            const postalCode = place.addressComponents
              ?.find((c) => c.types.includes('postal_code'))
              ?.longText ?? null;
            selectedPlaceRef.current = {
              formattedAddress: place.formattedAddress ?? '',
              lat: place.location ? place.location.lat() : null,
              lng: place.location ? place.location.lng() : null,
              postalCode,
            };
            // Capture what the widget is DISPLAYING now (the prediction
            // label), which is what a later edit would change.
            selectedDisplayRef.current = autocompleteEl.value ?? '';
            if (cancelled) return;
            setAddressText(place.formattedAddress ?? '');
            setError('');
          } catch (err) {
            if (!cancelled) setError(err.message ?? 'Could not read that address. Please try selecting it again.');
          }
        };
        autocompleteEl.addEventListener('gmp-select', onSelect);

        // Best-effort guard: if the user edits the address after picking one
        // (without choosing a new suggestion), invalidate the stale
        // selection so it can't be silently saved. PlaceAutocompleteElement
        // is form-associated and composes a real <input> internally, so a
        // native 'input' event is expected to bubble out of it; if it
        // doesn't in some browser, the "pick from suggestions" check at
        // submit time still catches an unset selection.
        onInput = () => {
          if (selectedPlaceRef.current) {
            selectedPlaceRef.current = null;
            selectedDisplayRef.current = null;
            if (!cancelled) setAddressText('');
          }
        };
        autocompleteEl.addEventListener('input', onInput);

        // Surface runtime errors from the widget itself (e.g. API key/billing
        // issues, network failures) instead of failing silently.
        onError = () => {
          if (!cancelled) setError('Address lookup is unavailable right now.');
        };
        autocompleteEl.addEventListener('gmp-error', onError);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Could not load address search.');
      });

    return () => {
      cancelled = true;
      if (autocompleteEl) {
        if (onSelect) autocompleteEl.removeEventListener('gmp-select', onSelect);
        if (onInput) autocompleteEl.removeEventListener('input', onInput);
        if (onError) autocompleteEl.removeEventListener('gmp-error', onError);
        autocompleteEl.remove();
      }
      if (autocompleteElRef.current === autocompleteEl) autocompleteElRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleDay(key) {
    setWeekdays((cur) => (cur.includes(key) ? cur.filter((d) => d !== key) : [...cur, key]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const place = selectedPlaceRef.current;
    if (!place) {
      setError('Please pick your address from the suggestions so we can locate your area.');
      return;
    }
    if (!place.postalCode) {
      setError("That address didn't include a ZIP code. Please pick a more specific address.");
      return;
    }
    // Defense-in-depth: the 'input' listener above should have already
    // cleared selectedPlaceRef if the user edited the text after picking a
    // suggestion, but if that listener didn't fire, catch it here by
    // comparing the widget's current text against the text it displayed at
    // selection time. NOT against place.formattedAddress — the widget shows
    // the prediction label ("1950 West Rugby Avenue, College Park, GA, USA")
    // while formattedAddress is the canonical form ("1950 W Rugby Ave,
    // College Park, GA 30337, USA"), so comparing those rejects every valid
    // selection. Only compare when we actually recorded a display value.
    const typed = (autocompleteElRef.current?.value ?? '').trim();
    const selectedDisplay = (selectedDisplayRef.current ?? '').trim();
    if (typed && selectedDisplay && typed !== selectedDisplay) {
      setError('Please pick your address from the suggestions again.');
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
      <h1>{family ? 'Edit your family' : 'Add your family'}</h1>

      <label>Your name
        <input required value={parentName} onChange={(e) => setParentName(e.target.value)} />
      </label>

      <label>Child name(s)
        <input required value={childNames} onChange={(e) => setChildNames(e.target.value)} placeholder="e.g. Jordan, Riley" />
      </label>

      <label>Home address</label>
      <div ref={addressContainerRef} />
      {addressText && <p>Confirmed: {addressText}</p>}
      <p>We use your address only to match you by area. Other families see just your general area, never your exact address.</p>

      <fieldset>
        <legend>When do you need carpool?</legend>
        {['am', 'pm', 'both'].map((d) => (
          <label key={d}>
            <input type="radio" name="direction" value={d} checked={direction === d} onChange={() => setDirection(d)} />
            {d === 'am' ? 'Morning drop-off' : d === 'pm' ? 'Afternoon pickup' : 'Both'}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Which days?</legend>
        {DAYS.map((d) => (
          <label key={d.key}>
            <input type="checkbox" checked={weekdays.includes(d.key)} onChange={() => toggleDay(d.key)} />
            {d.label}
          </label>
        ))}
      </fieldset>

      <label>Phone (optional)
        <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
      </label>
      <label>Contact email
        <input type="email" required value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
      </label>

      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving…' : submitLabel ?? (family ? 'Save changes' : 'Add my family')}
      </button>
    </form>
  );
}
