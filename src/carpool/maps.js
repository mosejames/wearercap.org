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

export function loadPlaces() {
  // async IIFE so a missing-key throw becomes a rejected promise, not a sync throw
  if (!placesPromise) placesPromise = (async () => { configure(); return importLibrary('places'); })();
  return placesPromise;
}

export function loadGeocoding() {
  if (!geocodingPromise) geocodingPromise = (async () => { configure(); return importLibrary('geocoding'); })();
  return geocodingPromise;
}
