import { supabase } from './supabaseClient.js';

export async function fetchRetirementNotices(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from('carpool_retirement_notices')
    .select('id, group_name').eq('user_id', userId).is('dismissed_at', null);
  if (error) throw error;
  return data ?? [];
}

export async function dismissRetirementNotice(id, userId) {
  if (!id || !userId) throw new Error('Notice and family are required.');
  const { error } = await supabase.from('carpool_retirement_notices')
    .update({ dismissed_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}
