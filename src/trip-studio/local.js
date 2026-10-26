import {initialRegistry} from './model.js';
import {saveDraft} from '../../server/trip-studio/model.js';
const KEY = 'rcap-trip-studio-local-v1';
export async function localStudio(method = 'GET', body) {
  let registry;
  try { const saved = localStorage.getItem(KEY); registry = saved ? JSON.parse(saved) : initialRegistry(); }
  catch { throw Error('Could not read this browser’s draft storage.'); }
  if (method === 'POST') {
    registry = saveDraft(registry, body.draft, body.revision);
    try { localStorage.setItem(KEY, JSON.stringify(registry)); }
    catch { throw Error('This browser could not save the draft. Try smaller branding images.'); }
  }
  return {registry, me:{email:'Local workspace on this browser'}};
}
