import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

let configured = false;
function configure() {
  if (configured) return;
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!key) throw new Error('Missing VITE_GOOGLE_MAPS_KEY');
  setOptions({ key, v: 'weekly' });
  configured = true;
}

let placesPromise;
let geocodingPromise;
let mapsPromise;
let markerPromise;

export function loadPlaces() {
  // async IIFE so a missing-key throw becomes a rejected promise, not a sync throw
  // Resolves with the full places library; consumers destructure
  // AutocompleteSuggestion + AutocompleteSessionToken (the Autocomplete Data
  // API that powers our own suggestion UI — Google's PlaceAutocompleteElement
  // widget is deliberately NOT used: on phones it goes fullscreen over the
  // form and that cannot be disabled).
  if (!placesPromise) placesPromise = (async () => { configure(); return importLibrary('places'); })();
  return placesPromise;
}

export function loadGeocoding() {
  if (!geocodingPromise) geocodingPromise = (async () => { configure(); return importLibrary('geocoding'); })();
  return geocodingPromise;
}

export function loadMaps() {
  if (!mapsPromise) mapsPromise = (async () => { configure(); return importLibrary('maps'); })();
  return mapsPromise;
}

export function loadMarker() {
  if (!markerPromise) markerPromise = (async () => { configure(); return importLibrary('marker'); })();
  return markerPromise;
}
