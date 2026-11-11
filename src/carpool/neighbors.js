import { supabase } from './supabaseClient.js';
import { placeName } from './crews.js';

// Mutual interest (migration 20261111022500). carpool_neighbors() is the only
// parent-facing read of other families. Rows that are not a mutual match carry
// area, schedule and distance only: parent_name, child_names and contact are
// NULL from the server, not hidden in the UI. Matches come first.
export async function fetchNeighbors() {
  const { data, error } = await supabase.rpc('carpool_neighbors');
  if (error) throw error;
  return data ?? [];
}

export async function setInterest(familyId, interested) {
  if (!familyId) throw new Error('A family is required.');
  const { data, error } = await supabase.rpc('set_carpool_interest', {
    p_family: familyId,
    p_interested: !!interested,
  });
  if (error) throw error;
  return data ?? { interested: !!interested, mutual: false };
}

export async function setPaused(paused) {
  const { data, error } = await supabase.rpc('set_carpool_paused', { p_paused: !!paused });
  if (error) throw error;
  return data;
}

// Split the server rows into the two lists the screen shows.
export function splitNeighbors(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    matches: list.filter((r) => r.mutual),
    nearby: list.filter((r) => !r.mutual),
  };
}

// "A family in Union City". Never a name: a non-match has none to give.
export function areaTitle(row) {
  const place = placeName(row?.area_label);
  if (place) return `A family in ${place}`;
  return row?.area_label ? `A family in area ${row.area_label}` : 'A family near you';
}

export function distanceLine(miles) {
  if (typeof miles !== 'number' || !Number.isFinite(miles)) return '';
  if (miles < 1) return 'Same area as you';
  const rounded = Math.round(miles);
  return `About ${rounded} ${rounded === 1 ? 'mile' : 'miles'} between areas`;
}

export function firstName(fullName) {
  const name = String(fullName ?? '').trim();
  return name ? name.split(/\s+/)[0] : '';
}

// The intro email links to /carpool/?from=intro. Read once; the banner is a
// courtesy, so anything unexpected simply means no banner.
export function cameFromIntro(search) {
  try {
    return new URLSearchParams(search ?? '').get('from') === 'intro';
  } catch {
    return false;
  }
}
