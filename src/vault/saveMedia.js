const EXTENSIONS = { 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm' };
export async function prepareSaveFile(photo, url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Could not prepare this file. Try downloading the original below.');
  const blob = await response.blob();
  if (!blob.size) throw new Error('This file is empty. Please try again.');
  const type = photo.contentType || blob.type;
  const extension = EXTENSIONS[type] || photo.key?.split('.').at(-1)?.replace(/[^a-z0-9]/gi,'') || 'bin';
  return new File([blob], `ami-vault-${photo.id}.${extension}`, { type });
}
export function canSaveToPhotos(file, nav = navigator) {
  try { return !!file && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] }); }
  catch { return false; }
}
