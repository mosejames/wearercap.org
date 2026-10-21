export const NYC = Object.freeze({
    id: 'nyc-2026', slug: 'nyc-vault', name: 'RCA Takes New York', grade: 'Sixth Grade', cohort: 'Class of 2029',
    start: '2026-10-21', end: '2026-10-23', timezone: 'America/New_York',
    dateLabel: 'October 21–23, 2026', storagePrefix: 'nyc-2026/', analyticsNamespace: 'nyc-2026',
    authStorageKey: 'nyc-2026-verified-auth', localNamespace: 'nyc-2026-preview-v1',
    ogImage: 'https://wearercap.org/nyc/nyc-vault-2029-og.jpg', videoUploadUrl: 'https://www.dropbox.com/request/tyv8e6kq7zeoaj18ywsk',
    places: [
        { id: 'empire-state', name: 'Empire State Building' }, { id: 'lost-boys', name: 'Lost Boys' },
        { id: 'madame-tussauds', name: 'Madame Tussauds' }, { id: 'met', name: 'MET' }, { id: 'musicals', name: 'Musicals' },
    ],
});
export function dayOf(photo, trip = NYC) {
    const time = Date.parse(photo.takenAt);
    return Number.isFinite(time) ? new Intl.DateTimeFormat('en-CA', { timeZone: trip.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(time) : '';
}
export function visiblePhotos(photos, { day = '', place = '' } = {}, trip = NYC) {
    return photos.filter(p => p.vault === trip.id && !p.hidden && (!day || dayOf(p, trip) === day) && (!place || p.place === place));
}
export function storageKey(owner, album, id, file, trip = NYC) {
    if (!/^[a-f0-9]{8}$/.test(owner) || !/^[a-z0-9-]{1,60}$/.test(album) || !/^[a-f0-9-]{36}$/.test(id) || !/^(orig\.(jpg|png|heic|webp)|web\.jpg|thumb\.jpg)$/.test(file))
        throw Error('Invalid media path');
    return `${trip.storagePrefix}${owner}/${album}/${id}/${file}`;
}
