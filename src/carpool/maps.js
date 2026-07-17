import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;

if (!key) {
  throw new Error('Missing VITE_GOOGLE_MAPS_KEY');
}

setOptions({ key, v: 'weekly' });

let placesPromise;
let geocodingPromise;

export function loadPlaces() {
  if (!placesPromise) placesPromise = importLibrary('places');
  return placesPromise;
}

export function loadGeocoding() {
  if (!geocodingPromise) geocodingPromise = importLibrary('geocoding');
  return geocodingPromise;
}
