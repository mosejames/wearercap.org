import { rewardCall } from './rewards.js';
import { getToken } from './data.js';
let fallback;
const recorded = new Set();
const pending = new Set();
export function viewSession() {
  try { const existing=sessionStorage.getItem('ami-vault-view-session'); if(/^[a-f0-9]{48}$/.test(existing || '')) return existing; } catch { /* private browsing */ }
  fallback ||= Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');
  try { sessionStorage.setItem('ami-vault-view-session',fallback); } catch { /* use this page session */ }
  return fallback;
}
export async function recordView(photoId) {
  if(recorded.has(photoId) || pending.has(photoId)) return;
  pending.add(photoId);
  try {
    await rewardCall('vault_record_view',{p_photo:photoId,p_session:viewSession(),p_legacy:getToken()});
    recorded.add(photoId);
  } catch { /* Viewing must still work offline; retry on the next open. */ }
  finally { pending.delete(photoId); }
}
