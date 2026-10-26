export const TRIPS = ['London', 'New York', 'Savannah'];
export function tripSubmission(values) {
  const trip = String(values.trip || '');
  const comment = String(values.comment || '').trim();
  if (!TRIPS.includes(trip)) throw Error('Choose London, New York or Savannah.');
  if (!comment || comment.length > 1500) throw Error('Share a few words, up to 1,500 characters.');
  if (values.permission !== 'on') throw Error('Please confirm permission for newsletter use.');
  return {
    name: String(values.name || '').trim(), email: String(values.email || '').trim(),
    relationship: 'Parent or family member', category: 'Photos or recap',
    title: `${trip}: a parent’s perspective`,
    details: `${comment}\n\nTrip: ${trip}\nNewsletter credit: Parent name as supplied.\nParent/family submission. Permission given to use my name, comments and photo in the RCAP newsletter.`,
    links: '', requestedDate: '', website: String(values.website || ''), permission: 'on',
  };
}
export async function submitTripStory(payload, photo, { call, prepare, encode, progress = () => {} }) {
  let token; const attachmentIndices = [];
  if (photo) {
    progress('Getting your photo ready…');
    const prepared = await prepare(photo);
    if (prepared.web.size > 3 * 1024 * 1024) throw Error('That photo is still too large. Please choose a smaller one.');
    ({ token } = await call('uploadSession', { website: payload.website }));
    progress('Adding your photo…');
    await call('uploadAttachment', { token, index: 0, name: 'family-trip-photo.jpg', data: await encode(prepared.web) });
    attachmentIndices.push(0);
  }
  progress('Sharing with the newsletter team…');
  const result = await call('submit', { ...payload, token, attachmentIndices });
  if (!result?.ok) throw Error('We could not confirm your submission. Please try again.');
  return result;
}
