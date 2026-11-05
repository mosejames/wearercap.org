// Compatibility exports. Both site and app now use the shared community source.
import content from '../community/content.json';
export const CALENDAR_SOURCE = content.calendar.source;
export const CALENDAR_EDITION = content.calendar.edition;
export * from '../community/calendar.js';
