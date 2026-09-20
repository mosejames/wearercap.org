const KEY = 'rcap-karaoke-promo-seen-2026-09-27';
export function markPromoSeen() {
  try { sessionStorage.setItem(KEY, '1'); } catch { /* Storage may be disabled. */ }
}
export function hasSeenPromo() {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}
