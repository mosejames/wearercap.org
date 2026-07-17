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
