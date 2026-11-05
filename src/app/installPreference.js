export const INSTALL_NUDGE_KEY='rcap-home-screen-guide-v1';
export function readInstallPreference(storage) {
  try{return ['seen','dismissed','installed','confirmed'].includes(storage.getItem(INSTALL_NUDGE_KEY));}catch{return false;}
}
export function saveInstallPreference(storage,reason='dismissed') {
  try{storage.setItem(INSTALL_NUDGE_KEY,reason);return true;}catch{return false;}
}
