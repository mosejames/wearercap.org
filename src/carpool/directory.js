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

export async function fetchAreaCount() {
  const { data, error } = await supabase.rpc('area_family_count');
  if (error) throw error;
  return data ?? 0;
}
