import { createClient } from '@supabase/supabase-js';
// Keep vault sign-in separate from the other RCAP applications.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { storageKey: 'ami-vault-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
export function normalizePhone(value) {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, '');
  if (/^\d{10}$/.test(digits) && !raw.startsWith('+')) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  if (raw.startsWith('+') && /^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  throw new Error('Enter a 10-digit US number, or include + and your country code.');
}
export async function authHeaders() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}
export async function sendCode(phone) {
  const { error } = await supabase.auth.signInWithOtp({ phone: normalizePhone(phone), options: { channel: 'sms' } });
  if (error) throw error;
}
export async function verifyCode(phone, token) {
  if (!/^\d{6}$/.test(token)) throw new Error('Enter the six-digit code from your text.');
  const { error } = await supabase.auth.verifyOtp({ phone: normalizePhone(phone), token, type: 'sms' });
  if (error) throw error;
}
