import destinationPhotos from './destinations.json';
export const VAULT = { id: 'london-2028', name: 'RCA 2028 Takes London' };
export const MAX_FILE_MB = 50;
export const MAX_VIDEO_INPUT_MB = 500;
export const MAX_VIDEO_STORED_MB = 100;
export const UPLOAD_PARALLEL = 3;
export const MAX_BATCH = 60;
export const PREP = { slug: 'before-the-adventure', title: 'Before the adventure', date: null, label: 'Before departure', blurb: 'Packing, big questions and the excitement at home. Our first postcards start with our families.', ideas: ['What are you most excited to see or do?', 'What’s going in your suitcase?', 'What do you think London will be like?'] };
export const DAYS = [
  { slug: 'the-whole-adventure', title: 'The whole adventure', date: null, label: 'Any time', blurb: 'The little moments between the big ones. Every group, one shared story.', ideas: ['A laugh on the way to the next stop', 'Friends figuring something out together', 'A view through their eyes'] },
  PREP,
  { slug: 'off-we-go', title: 'Off we go', date: '2026-10-11', label: 'Sun · Oct 11', blurb: 'Airport hellos, travel buddies and the beginning of something big.', ideas: ['Travel buddies before boarding', 'That ready-for-adventure smile', 'The view from the window'] },
  { slug: 'hello-london', title: 'Hello, London', date: '2026-10-12', label: 'Mon · Oct 12', blurb: 'Tower of London, fish and chips, London Dungeon, National Portrait Gallery and Trafalgar Square.', ideas: ['Their first look at the Tower of London', 'The verdict on fish and chips', 'Friends taking in Trafalgar Square'] },
  { slug: 'history-and-six', title: 'History, meet the West End', date: '2026-10-13', label: 'Tue · Oct 13', blurb: 'Westminster Abbey, British Museum, Madame Tussauds and SIX.', ideas: ['A moment outside Westminster Abbey', 'A discovery at the British Museum, where photos are allowed', 'The smiles outside SIX before the show'] },
  { slug: 'palaces-and-stones', title: 'Palaces, stones & a little magic', date: '2026-10-14', label: 'Wed · Oct 14', blurb: 'Hampton Court Palace, Stonehenge and an evening at Wicked.', ideas: ['A sense-of-scale photo at Stonehenge', 'Exploring Hampton Court together', 'The excitement outside Wicked'] },
  { slug: 'bonjour-paris', title: 'Bonjour, Paris', date: '2026-10-15', label: 'Thu · Oct 15', blurb: 'Train to Paris, the Louvre, dinner together and the Eiffel Tower at night.', ideas: ['Train-window wonder on the way to Paris', 'A shared discovery at the Louvre, where allowed', 'Their faces when the Eiffel Tower lights up'] },
  { slug: 'a-day-to-remember', title: 'A day to remember', date: '2026-10-16', label: 'Fri · Oct 16', blurb: 'Versailles, Napoleon’s Tomb, Notre-Dame and a dinner cruise on the Seine.', ideas: ['Taking in the gardens at Versailles', 'A group moment outside Notre-Dame', 'Friends around the dinner table on the Seine'] },
  { slug: 'home-with-stories', title: 'Home with stories', date: '2026-10-17', label: 'Sat · Oct 17', blurb: 'One last look, the journey home and those airport reunion hugs.', ideas: ['A last travel-buddy photo', 'A favorite memory in their own words', 'The reunion at home'] },
];
export function basePath(path = window.location.pathname) {
  if (path.endsWith('/')) return path;
  const cut = path.lastIndexOf('/');
  return path.slice(cut + 1).includes('.') ? path.slice(0, cut + 1) : `${path}/`;
}
export function tripToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function ideasFor(slug) { return (DAYS.find((day) => day.slug === slug) || DAYS[0]).ideas; }

export const DESTINATIONS = Object.fromEntries(destinationPhotos.map((p) => [p.id, { ...p, image: `/london/${p.id}.jpg`, thumb: `/london/${p.id}-thumb.jpg` }]));
const CHAPTERS = {
 'before-the-adventure': { image: 'london-morning', place: 'The adventure starts at home', greeting: 'Big dreams. Almost-packed bags.', mood: 'Our families send the first postcards.', route: 'NEXT STOP · LONDON', city: 'london' },
 'the-whole-adventure': { image: 'london-morning', place: 'London', greeting: 'London is calling.', mood: 'A week of wonder is waiting.', route: 'ATL → LHR', city: 'london' },
 'off-we-go': { image: 'london-morning', place: 'London awaits', greeting: 'And so the adventure begins.', mood: 'Travel buddies, airport hellos and a whole world ahead.', route: 'ATL → LHR', city: 'london' },
 'hello-london': { image: 'tower-of-london', place: 'Tower of London', greeting: 'Good morning, London.', mood: 'A first day of history, discovery and fish and chips.', route: 'HELLO, LONDON', city: 'london' },
 'history-and-six': { image: 'westminster-abbey', place: 'Westminster Abbey', greeting: 'A new day. Centuries to discover.', mood: 'From Westminster Abbey to the British Museum, then SIX.', route: 'LONDON · DAY 2', city: 'london' },
 'palaces-and-stones': { image: 'stonehenge', place: 'Stonehenge', greeting: 'Oh, the stories these stones could tell.', mood: 'Hampton Court, Stonehenge and a little Wicked magic.', route: 'LONDON · DAY 3', city: 'london' },
 'bonjour-paris': { image: 'paris-evening', place: 'The Eiffel Tower', greeting: 'Bonjour, a whole new chapter.', mood: 'A train to Paris, the Louvre and a city full of light.', route: 'LONDON → PARIS', city: 'paris' },
 'a-day-to-remember': { image: 'versailles', place: 'The gardens of Versailles', greeting: 'Another morning. More wonder.', mood: 'Versailles, Napoleon’s Tomb, Notre-Dame and the Seine.', route: 'PARIS · DAY 2', city: 'paris' },
 'home-with-stories': { image: 'london-morning', place: 'A last look at London', greeting: 'Home with a world of stories.', mood: 'Travel buddies today. Remember-when friends forever.', route: 'CDG → ATL', city: 'london' },
};
export function chapterFor(album = 'all', today = tripToday()) {
 const selected = DAYS.find((d) => d.slug === album && (d.date || d.slug === PREP.slug));
 const calendarDay = DAYS.find((d) => d.date === today);
 const day = selected || calendarDay || (today > '2026-10-17' ? DAYS.at(-1) : DAYS[0]);
 const chapter = CHAPTERS[day.slug];
 return { ...chapter, photo: DESTINATIONS[chapter.image], day,
   label: selected ? day.label : calendarDay ? `Today · ${day.label}` : today > '2026-10-17' ? 'A week to remember' : 'Before the adventure' };
}

export { default as INSPIRATIONS } from './inspirations.json';
