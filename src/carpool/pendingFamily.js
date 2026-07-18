const KEY = 'carpool.pendingFamily';

export function stashPendingFamily(payload) {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(payload)); } catch { /* storage unavailable */ }
}

export function readPendingFamily() {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    clearPendingFamily();
    return null;
  }
}

export function clearPendingFamily() {
  try { window.sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
