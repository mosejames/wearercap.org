import { supabase } from './supabaseClient.js';

const VALID_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

export function buildFamilyRecord(input) {
  const {
    userId, parentName, childNames, place, areaGeocode,
    direction, weekdays, contactPhone, contactEmail,
  } = input;

  const required = { userId, parentName, childNames, place, areaGeocode, contactEmail };
  for (const [k, v] of Object.entries(required)) {
    if (v === undefined || v === null || v === '') throw new Error(`Missing required field: ${k}`);
  }
  if (!['am', 'pm', 'both'].includes(direction)) throw new Error(`Invalid direction: ${direction}`);
  if (!Array.isArray(weekdays) || weekdays.length === 0) throw new Error('weekdays must be a non-empty array');
  if (!weekdays.every((d) => VALID_DAYS.includes(d))) throw new Error('weekdays must be within mon..fri');

  return {
    user_id: userId,
    parent_name: parentName,
    child_names: childNames,
    address: place.formattedAddress,
    lat: place.lat,
    lng: place.lng,
    area_lat: areaGeocode.lat,
    area_lng: areaGeocode.lng,
    area_label: areaGeocode.label,
    direction,
    weekdays,
    contact_phone: contactPhone ? contactPhone : null,
    contact_email: contactEmail,
  };
}

export async function fetchFamily(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('families')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveFamily(record) {
  const { error } = await supabase
    .from('families')
    .upsert(record, { onConflict: 'user_id' });
  if (error) throw error;
}

// The family's personal radius override (migration 0009). `null` clears it back
// to the adaptive default (auto-widen); a number is the explicit "show me
// families within N miles" cap. The guard mirrors the families CHECK
// constraint: null, or a number inside the metro-capped [1, 25]. Writes ONLY
// radius_miles on the caller's own row, so it can never touch another column.
export async function setFamilyRadius(userId, radiusMiles) {
  if (!userId) throw new Error('setFamilyRadius needs a userId');
  if (
    radiusMiles !== null &&
    !(typeof radiusMiles === 'number' && radiusMiles >= 1 && radiusMiles <= 25)
  ) {
    throw new Error('radiusMiles must be null or a number between 1 and 25');
  }
  const { error } = await supabase
    .from('families')
    .update({ radius_miles: radiusMiles })
    .eq('user_id', userId);
  if (error) throw error;
}
