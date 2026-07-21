import { supabase } from './supabaseClient.js';

const EARTH_RADIUS_MILES = 3959;

export function milesBetween(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const h =
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(toRad(bLng) - toRad(aLng)) +
    Math.sin(toRad(aLat)) * Math.sin(toRad(bLat));
  return EARTH_RADIUS_MILES * Math.acos(Math.min(1, h));
}

export function rankNearby(me, families, { limit = 20 } = {}) {
  return families
    .filter((f) => f.user_id !== me.user_id)
    .map((f) => ({ ...f, distanceMiles: milesBetween(me.area_lat, me.area_lng, f.area_lat, f.area_lng) }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles || a.parent_name.localeCompare(b.parent_name))
    .slice(0, limit);
}

export async function fetchDirectory() {
  const { data, error } = await supabase.rpc('family_directory');
  if (error) throw error;
  return data ?? [];
}

// The radius-scoped near-you list (migration 0009). nearby_families() returns
// the caller's in-radius families already filtered to their effective radius
// and ordered nearest-first, each row carrying distance_miles (caller -> that
// family) and distance_to_school_miles (that family -> Ron Clark Academy).
// fetchDirectory above is intentionally kept: admin.js still reads the full,
// unscoped family_directory().
export async function fetchNearby() {
  const { data, error } = await supabase.rpc('nearby_families');
  if (error) throw error;
  return data ?? [];
}

// TEMPORARY BRIDGE — remove once migration 0009 is applied to the database.
// Until then nearby_families() does not exist, so calling it fails. This
// predicate matches ONLY that narrow case (PostgREST returns code PGRST202 and
// a "Could not find the function ... in the schema cache" message for a missing
// RPC) so MapView can fall back to the pre-0009 flat directory rather than show
// a blank map. Any other error (permissions, network, a real RPC failure) does
// not match and still surfaces to the user as before.
export function isMissingRpcError(error) {
  if (!error) return false;
  if (error.code === 'PGRST202') return true;
  const msg = (error.message ?? '').toLowerCase();
  return msg.includes('could not find the function') || msg.includes('schema cache');
}

export async function fetchAreaCount() {
  const { data, error } = await supabase.rpc('area_family_count');
  if (error) throw error;
  return data ?? 0;
}
