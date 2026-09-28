const timestamp = value => {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
};
const uploaded = photo => timestamp(photo.createdAt) ?? 0;
const taken = photo => timestamp(photo.takenAt) ?? uploaded(photo);

// Stable ties keep incoming uploads from reshuffling photos with the same date.
export function sortGallery(photos, order = 'time') {
  return photos.filter(photo => !photo.hidden && !photo.removedAt).sort((a, b) => {
    const tie = uploaded(a) - uploaded(b) || String(a.id).localeCompare(String(b.id));
    if (order === 'loved') return (b.likes || 0) - (a.likes || 0) || tie;
    if (order === 'new') return uploaded(b) - uploaded(a) || tie;
    const chronology = taken(a) - taken(b);
    return (order === 'taken-new' ? -chronology : chronology) || tie;
  });
}
