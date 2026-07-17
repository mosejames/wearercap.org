import { supabase } from './supabaseClient.js';

// Pure decision: given the current auth session and the user's member row
// (or null if none exists yet), which view should the app render?
export function resolveView(session, member) {
  if (!session) return 'signed-out';
  if (!member || member.approval !== 'approved') return 'pending';
  return member.role === 'admin' ? 'admin' : 'ready';
}

// Read the caller's own member row (RLS restricts this to self/admin).
export async function fetchMember(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('members')
    .select('user_id, email, role, approval')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// On first sign-in, create the pending member row. Safe to call every login;
// a duplicate primary key is expected and ignored.
export async function ensureMemberRow(user) {
  if (!user) return;
  const { error } = await supabase
    .from('members')
    .insert({ user_id: user.id, email: user.email });
  // 23505 = unique_violation (row already exists) — not an error for us.
  if (error && error.code !== '23505') throw error;
}
