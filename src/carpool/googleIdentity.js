// Google Identity Services, loaded the same way maps.js loads Google Maps:
// dynamically, from JS, memoized. There is deliberately no <script> tag in
// carpool/index.html. A blocked or slow accounts.google.com must never sit
// between a parent and first paint, and the sign in screen has to render with
// or without this file arriving.
//
// WHY THIS EXISTS AT ALL. signInWithOAuth hands the parent to GoTrue, so the
// Google consent screen names GoTrue's own callback host, which on a free
// project is the raw project ref (kcsrtwwpnekqdrfgcfys.supabase.co). A parent
// deciding whether to trust a stranger's site with their child's school run
// reads that random string at the worst possible moment. Getting the ID token
// in the browser instead keeps Supabase's host out of the flow entirely, so
// Google shows wearercap.org, which is the name they already trust.

const GIS_SRC = 'https://accounts.google.com/gsi/client';

// Read once, with a fallback, so a missing var degrades to the redirect flow
// instead of throwing during render. Vite inlines this at BUILD time, so the
// var has to exist in the build environment (Vercel), not just at runtime.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

let gisPromise;

// Resolves with window.google.accounts.id, or rejects. The timeout matters as
// much as the error handler: a hung request never fires onerror, and a parent
// staring at an empty space where a button should be has no way to know the
// email option below still works.
export function loadGoogleIdentity({ timeoutMs = 8000 } = {}) {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('No document; Google Identity Services cannot load'));
      return;
    }
    if (window.google?.accounts?.id) {
      resolve(window.google.accounts.id);
      return;
    }
    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(arg);
    };
    const timer = setTimeout(
      () => finish(reject, new Error('Google Identity Services timed out')),
      timeoutMs,
    );
    let el = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (!el) {
      el = document.createElement('script');
      el.src = GIS_SRC;
      el.async = true;
      el.defer = true;
      document.head.appendChild(el);
    }
    el.addEventListener('load', () => {
      // Loaded but hollow is a real state (an intercepting proxy, a corporate
      // filter serving an empty 200). Treat it as a failure, not a success.
      if (window.google?.accounts?.id) finish(resolve, window.google.accounts.id);
      else finish(reject, new Error('Google Identity Services loaded with no id client'));
    });
    el.addEventListener('error', () => finish(reject, new Error('Google Identity Services failed to load')));
  });
  return gisPromise;
}

// Supabase's documented nonce scheme for signInWithIdToken, and it is required
// here rather than optional: Google embeds the nonce it was given into the ID
// token, and GoTrue recomputes SHA-256 over the value we pass and compares. So
// Google gets the HASHED value and Supabase gets the UNHASHED one. Sending the
// same form to both fails validation.
//
// Throws if Web Crypto is missing (an insecure origin). The caller treats that
// like any other setup failure and shows the redirect button instead.
export async function createGoogleNonce() {
  const c = globalThis.crypto;
  if (!c?.subtle?.digest || !c?.getRandomValues) {
    throw new Error('Web Crypto is not available; cannot build a nonce');
  }
  const raw = c.getRandomValues(new Uint8Array(32));
  const nonce = btoa(String.fromCharCode(...raw));
  const digest = await c.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  const hashedNonce = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { nonce, hashedNonce };
}
