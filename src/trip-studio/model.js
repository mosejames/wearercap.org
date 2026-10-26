export const DEFAULT_MILESTONES = [{count:100,label:'First 100 moments in {destination}'},{count:250,label:'250 windows into the adventure'},{count:500,label:'500+ memories to bring home'}];
export const PHASES = ['Draft', 'Send-off', 'Active trip', 'Wrap-up', 'Archive'];
export const FEATURES = {
  sendoff: 'Parent packing and send-off photos', videos: 'Separate video collection',
  conversations: 'Reactions and comments', remember: 'Remember chaperone name and group',
  milestones: '100 / 250 / 500+ photo milestones', download: 'Individual photo downloads',
};
export const REFERENCES = [
  { id: 'nyc-2026', destination: 'New York City', cohort: '2029', dates: 'October 21–23, 2026', href: '/nyc-vault/' },
  { id: 'london-2028', destination: 'London & Paris', cohort: '2028', dates: 'October 11–17, 2026', href: '/2028-london/' },
];
export function newDraft(id = crypto.randomUUID(), destination = '') {
  return { id, destination, cohort: '', start: '', end: '', timezone: '', slug: '', status: 'draft', visibility: 'private',
    colors: { navy: '#102448', yellow: '#f5cc48', paper: '#faf9f4' }, logo: '', hero: '',
    milestones: DEFAULT_MILESTONES.map(m=>({...m})),
    features: Object.fromEntries(Object.keys(FEATURES).map(k => [k, true])), groups: ['Group A', 'Group AA', 'Mixed'],
    videoUploadUrl: '', videoDownloadUrl: '', exportDays: 7, recipientBinding: true, updatedAt: '' };
}
export function initialRegistry() { return { revision: 0, trips: [newDraft('dc-draft', 'Washington, DC')] }; }
export function suggestedSlug(trip) {
  return [trip.destination, trip.cohort].filter(Boolean).join('-').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
}
export function readiness(t) {
  const missing = [];
  if (!t.destination.trim()) missing.push('Destination');
  if (!/^20\d{2}$/.test(t.cohort)) missing.push('Class year');
  if (!t.start || !t.end) missing.push('Trip dates');
  else if (t.end < t.start) missing.push('Return date after departure');
  if (!t.timezone) missing.push('Timezone');
  if (!t.slug) missing.push('Stable link slug');
  if (!t.logo) missing.push('Logo');
  return missing;
}
export function messageFor(trip, phase, audience, liveUrl) {
  const cohort = trip.cohort ? `Class of ${trip.cohort}` : '[class year]';
  const destination = trip.destination || '[destination]';
  const link = liveUrl || '[trip link available after launch]';
  if (audience === 'Chaperones') return `Thank you for bringing ${cohort}’s ${destination} adventure home to families. Open ${link}, choose ${trip.groups.join(', ')} for this batch, confirm your name and add a few photos.${trip.features.remember ? ' Your name and group are remembered on this device. Change groups whenever needed.' : ''} No scholar names needed.${trip.features.videos && trip.videoUploadUrl ? ' Use Share videos for clips.' : ''}`;
  return {
    Draft: `${cohort} is heading to ${destination}. Our trip album is being prepared. We’ll share the family link when it is ready.`,
    'Send-off': `The ${destination} adventure starts at home. Add packing moments and send-off smiles for ${cohort}: ${link}.${trip.features.videos && trip.videoUploadUrl ? ' Use Share videos for clips.' : ''} Keep this link to follow the trip.`,
    'Active trip': `Follow ${cohort} in ${destination}: ${link}. Enjoy the latest photos${trip.features.conversations ? ', leave a quick thank-you' : ''}${trip.features.download ? ' and download your favorites' : ''}. This same link holds the whole story.`,
    'Wrap-up': `Home with stories. Revisit ${cohort}’s ${destination} moments at ${link}. Add any last photos and thank the chaperones who shared the adventure.`,
    Archive: `${cohort}’s ${destination} memories are here: ${link}. Browse the trip album${trip.features.download ? ' and download favorite photos' : ''}.`,
  }[phase];
}
export const PHASE_COPY = {
  Draft: ['Review before families arrive.', 'Private preview. Public viewing and uploads are closed.'],
  'Send-off': ['The story starts at home.', 'Families share packing, front-door smiles and airport hugs.'],
  'Active trip': ['One tap into their day.', 'Chaperone intake leads. Families follow the shared gallery.'],
  'Wrap-up': ['Bring the story home.', 'Collect late moments, thank contributors and prepare staff downloads.'],
  Archive: ['Keep the memories close.', 'New uploads close. Gallery viewing and individual downloads remain available.'],
};
