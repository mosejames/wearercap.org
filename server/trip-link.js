// No route is enabled until the NYC backend and release are approved.
import { NYC } from '../src/trips/config.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function tripCard({ trip = NYC, event, photo, publicBase = '', slug = '', id = '' } = {}) {
    const validEvent = event?.vault === trip.id && !event.hidden && event.slug === slug;
    const validPhoto = validEvent && uuid.test(id) && photo?.id === id && photo.vault === trip.id && photo.event_id === event.id && !photo.hidden && photo.storage === 'r2' && photo.web_key?.startsWith(trip.storagePrefix) && !photo.web_key.split('/').some(p => p === '..' || p === '.') && /^https:\/\//.test(publicBase);
    const suffix = validEvent ? `e/${encodeURIComponent(slug)}${validPhoto ? `/p/${id}` : ''}` : '';
    const base = `https://wearercap.org/${trip.slug}/`;
    return { title: validPhoto ? `${event.title} · ${trip.cohort || trip.grade}` : trip.name, description: validPhoto ? (photo.caption || 'A moment from their New York adventure.') : `${trip.cohort || trip.grade} · ${trip.dateLabel}. Their adventure. Our postcards.`, image: validPhoto ? `${publicBase.replace(/\/+$/, '')}/${photo.web_key.split('/').map(encodeURIComponent).join('/')}` : trip.ogImage, canonical: base + suffix, destination: base + (suffix ? `#/${suffix}` : ''), exact: Boolean(validPhoto) };
}
export function renderTripCard(card) { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(card.title)}</title><meta name="robots" content="noindex,nofollow"><link rel="canonical" href="${esc(card.canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(card.title)}"><meta property="og:description" content="${esc(card.description)}"><meta property="og:url" content="${esc(card.canonical)}"><meta property="og:image" content="${esc(card.image)}"><meta property="og:image:type" content="image/jpeg">${card.exact ? '' : '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'}<meta property="og:image:alt" content="${esc(card.title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(card.title)}"><meta name="twitter:description" content="${esc(card.description)}"><meta name="twitter:image" content="${esc(card.image)}"><meta name="twitter:image:alt" content="${esc(card.title)}"><meta http-equiv="refresh" content="0; url=${esc(card.destination)}"></head><body><a href="${esc(card.destination)}">Open the album</a></body></html>`; }
export async function serveTripCard(req, res, { trip = NYC, lookupEvent, lookupVisiblePhoto, publicBase } = {}) {
    const slug = String(req.query?.slug || ''), id = String(req.query?.photo || '');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    let event, photo;
    try {
        if (/^[a-z0-9-]{1,60}$/.test(slug))
            event = await lookupEvent(trip.id, slug);
        if (event?.vault === trip.id && !event.hidden && uuid.test(id))
            photo = await lookupVisiblePhoto(trip.id, event.id, id);
    }
    catch { /* Fail closed to branded card. */ }
    return res.status(200).send(renderTripCard(tripCard({ trip, event, photo, publicBase, slug, id })));
}
