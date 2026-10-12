// Originals remain byte-for-byte archives. Only viewing uses compatible copies.
export function playbackKey(photo,renditions={}) {
 const key=renditions[photo.key];
 return photo.kind==='video' && typeof key==='string' && key.startsWith('london-2028/') && !key.split('/').includes('..') ? key : photo.key;
}
