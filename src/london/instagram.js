import sources from './storySources.json';
// Reviewed sharing references supplement the original uploader field. Raw source
// records stay in the private import ledger, and originals remain in R2.
export function instagramAccount(photo) {
  return /^Shared on Instagram by @([a-zA-Z0-9_.]{1,30})$/.exec(photo?.uploaderName || '')?.[1] || null;
}
export function instagramCredits(photo) {
  const account = instagramAccount(photo);
  if (!account) return [];
  return sources[photo.id]?.credits || [{account, url:`https://www.instagram.com/${account}/`}];
}
export function storyContext(photo) { return sources[photo?.id]?.context || ''; }
export function distinctStoryMedia(photos) {
  const visible = new Set(photos.map(photo => photo.id));
  return photos.filter(photo => !sources[photo.id]?.duplicateOf || !visible.has(sources[photo.id].duplicateOf));
}
