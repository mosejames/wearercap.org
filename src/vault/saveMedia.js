const EXTENSIONS = { 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm' };
export async function prepareSaveFile(photo, url, signal) {
  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Could not prepare this file. Try downloading the original below.');
  let blob = await response.blob();
  if (!blob.size) throw new Error('This file is empty. Please try again.');
  let type = photo.contentType || blob.type;
  if (type === 'image/gif' || /\.gif$/i.test(photo.key || '')) {
    const { gifToVideo } = await import('./gifVideo.js');
    blob = await gifToVideo(blob, signal);
    type = 'video/mp4';
  }
  const extension = EXTENSIONS[type] || photo.key?.split('.').at(-1)?.replace(/[^a-z0-9]/gi,'') || 'bin';
  return new File([blob], `${photo.house === "rcap" || photo.key?.startsWith("rcap/") ? "rcap-capsule" : "ami-vault"}-${photo.id}.${extension}`, { type });
}
export function canSaveToPhotos(file, nav = navigator) {
  try { return !!file && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] }); }
  catch { return false; }
}
