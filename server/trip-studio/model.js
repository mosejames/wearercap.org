import {newDraft, FEATURES, REFERENCES} from '../../src/trip-studio/model.js';
export function problem(message, status = 400) { return Object.assign(Error(message), { status }); }
function text(value, max, label) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u2014]/.test(value)) throw problem(`Check ${label}.`);
  return value.trim();
}
function date(value) {
  const v = text(value, 10, 'trip dates');
  if (v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v)) throw problem('Choose a valid trip date.');
  return v;
}
function url(value) {
  const v = text(value, 500, 'video link');
  if (!v) return '';
  let parsed; try { parsed = new URL(v); } catch { throw problem('Video links must be valid HTTPS URLs.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw problem('Video links must use HTTPS without credentials.');
  return parsed.href;
}
export function cleanDraft(value) {
  if (!value || typeof value !== 'object' || !/^(dc-draft|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(value.id || '')) throw problem('Choose a draft trip.');
  if (REFERENCES.some(t => t.id === value.id)) throw problem('Existing vaults are read-only.', 403);
  if (value.status !== 'draft' || value.visibility !== 'private') throw problem('Trips must stay private drafts.', 403);
  const d = newDraft(value.id);
  d.destination = text(value.destination, 80, 'destination');
  if (!d.destination) throw problem('Add a destination before saving.');
  d.cohort = text(value.cohort, 4, 'class year');
  if (d.cohort && !/^20\d{2}$/.test(d.cohort)) throw problem('Use a four-digit class year.');
  d.start = date(value.start); d.end = date(value.end);
  if (d.start && d.end && d.start > d.end) throw problem('Return must follow departure.');
  d.timezone = text(value.timezone, 80, 'timezone');
  if (d.timezone) { try { new Intl.DateTimeFormat('en', {timeZone: d.timezone}); } catch { throw problem('Choose a valid timezone.'); } }
  d.slug = text(value.slug, 70, 'link slug');
  if (d.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug)) throw problem('Use lowercase words separated by hyphens in the link.');
  if (['nyc-vault', 'nyc-2026', '2028-london', 'london-2028', 'nyc-sendoff'].includes(d.slug)) throw problem('This link belongs to an existing vault.');
  for (const key of Object.keys(d.colors)) {
    if (!/^#[a-f0-9]{6}$/i.test(value.colors?.[key] || '')) throw problem('Choose valid brand colors.');
    d.colors[key] = value.colors[key];
  }
  for (const key of Object.keys(FEATURES)) { if (typeof value.features?.[key] !== 'boolean') throw problem('Check the feature settings.'); d.features[key] = value.features[key]; }
  const milestones = value.milestones ?? d.milestones;
  if (!Array.isArray(milestones) || milestones.length !== 3) throw problem('Check the photo milestones.');
  d.milestones = milestones.map((m,i) => {
    if (m?.count !== [100,250,500][i]) throw problem('Use the 100, 250 and 500 photo milestones.');
    const label = text(m.label, 80, 'milestone label');
    if (!label) throw problem('Add a label for every milestone.');
    return {count:m.count,label};
  });
  for (const key of ['logo', 'hero']) {
    const v = value[key];
    if (typeof v !== 'string' || v.length > 750000 || v && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(v)) throw problem('Choose a PNG, JPEG or WebP image under 500 KB.');
    d[key] = v;
  }
  d.videoUploadUrl = url(value.videoUploadUrl); d.videoDownloadUrl = url(value.videoDownloadUrl);
  if (!Number.isInteger(value.exportDays) || value.exportDays < 1 || value.exportDays > 30) throw problem('Download invitations must expire in 1 to 30 days.');
  if (typeof value.recipientBinding !== 'boolean') throw problem('Check recipient binding.');
  d.exportDays = value.exportDays; d.recipientBinding = value.recipientBinding;
  return d;
}
export function saveDraft(registry, draft, revision, now = new Date().toISOString()) {
  if (!Number.isInteger(revision) || registry.revision !== revision) throw problem('Another save arrived first. Reload saved drafts before trying again.', 409);
  const clean = cleanDraft(draft);
  if (registry.trips.some(t => t.id !== clean.id && clean.slug && t.slug === clean.slug)) throw problem('Another draft already uses this link.');
  if (registry.trips.length >= 50 && !registry.trips.some(t => t.id === clean.id)) throw problem('The draft list is full.');
  clean.updatedAt = now;
  return {revision: registry.revision + 1, trips: [...registry.trips.filter(t => t.id !== clean.id), clean]};
}
