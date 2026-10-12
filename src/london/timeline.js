// Imported clips arrive later than the moment they depict. Preserve the trip's
// chronology without rewriting the actual upload timestamp.
export function captureTime(photo) {
  return Date.parse(photo.takenAt) || Date.parse(photo.createdAt) || 0;
}
export function newestCapturedFirst(a, b) {
  return captureTime(b) - captureTime(a) || (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
}
