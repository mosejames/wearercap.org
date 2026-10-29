const KEY = "rcap-boo-journey-v1";
// Only navigation flags live in sessionStorage. Photos, names, aliases and phone
// input stay in React memory. An interrupted tab gets an honest reselect prompt.
export function readJourney(storage) {
  try {
    storage ||= globalThis.sessionStorage;
    const raw = JSON.parse(storage.getItem(KEY) || "null");
    if (
      !raw ||
      !Number.isFinite(raw.at) ||
      !["upload", "guess", "notice", "standings"].includes(raw.kind) ||
      !["children", "adults"].includes(raw.mode) ||
      Date.now() - raw.at > 12 * 3600000
    )
      return null;
    return {
      kind: raw.kind,
      mode: raw.mode,
      photoId: /^[a-f0-9-]{36}$/i.test(raw.photoId || "") ? raw.photoId : null,
      hadPhoto: raw.hadPhoto === true,
    };
  } catch {
    return null;
  }
}
export function saveJourney(journey, storage) {
  try {
    storage ||= globalThis.sessionStorage;
    if (!journey) return storage.removeItem(KEY);
    storage.setItem(
      KEY,
      JSON.stringify({
        kind: journey.kind,
        mode: journey.mode,
        photoId: /^[a-f0-9-]{36}$/i.test(journey.photoId || "")
          ? journey.photoId
          : null,
        hadPhoto: journey.hadPhoto === true,
        at: Date.now(),
      }),
    );
  } catch {
    /* Private browsing/storage restrictions must not stop participation. */
  }
}
export const defaultPlayerName = (id) =>
  "Boo Player " +
  String(id || "")
    .replace(/-/g, "")
    .slice(-6)
    .toUpperCase();
export const splitNames = (value) =>
  String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
