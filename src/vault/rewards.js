import { supabase } from './auth.js';
export const MILESTONES = [10, 50, 100, 250, 500];
export const badgeName = (n) => ({10:'Memory maker',50:'Moment keeper',100:'House storyteller',250:'Friendship champion',500:'Vault legend'}[n] || 'Memory maker');
export async function rewardCall(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}
export const avatarUrl = (key) => key ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/vault-avatars/${key}` : null;
export function monthNow() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'America/New_York',year:'numeric',month:'2-digit' }).formatToParts(new Date());
  return `${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}`;
}
export async function saveAvatar(file, remove = false) {
  const owner = await rewardCall('vault_actor');
  if (!owner) throw new Error('Sign in to update your photo.');
  const key = `${owner}/profile.jpg`;
  if (remove) {
    await rewardCall('vault_avatar', { p_remove:true });
    const { error } = await supabase.storage.from('vault-avatars').remove([key]);
    if (error) throw error;
    return null;
  }
  if (!file || file.size > 20 * 1024 * 1024) throw new Error('Choose a photo smaller than 20 MB.');
  // Reuse the gallery decoder, including HEIC support, and strip EXIF metadata.
  const { prepareImage } = await import('./images.js');
  const prepared = await prepareImage(file);
  const blob = prepared.thumb;
  if (!blob || blob.size > 524288) throw new Error('Try a smaller profile photo.');
  const { error } = await supabase.storage.from('vault-avatars').upload(key, blob, { upsert:true,contentType:'image/jpeg',cacheControl:'0' });
  if (error) throw error;
  return await rewardCall('vault_avatar', {p_remove:false});
}
