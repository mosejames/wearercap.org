import { useEffect, useState } from 'react';

// Tiny hash "router" for the app's standalone screens (#sharing, #admin).
// One mechanism for both: the hash survives a reload, the browser back button
// closes the screen for free, and a link in an email lands straight on it.
// Callers compare the returned hash themselves and apply their own access
// rules, so this hook never decides who is allowed to see what.
export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

// Clearing location.hash leaves a trailing '#' in the URL, which is harmless
// but ugly; replaceState drops it without adding a history entry, then the
// hashchange listener needs a manual nudge because replaceState does not
// fire one.
export function clearHash() {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
