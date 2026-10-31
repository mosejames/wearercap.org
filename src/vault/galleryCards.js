import { supabase } from './auth.js';
export async function galleryCardsCall(action, payload = {}, pass = '') {
  const { data, error } = await supabase.rpc('vault_gallery_cards', { p_action: action, p_payload: payload, p_pass: pass });
  if (error) throw new Error(error.message);
  return data;
}
export function cardUrlOK(value) {
  if (typeof value !== 'string' || !value || value.length > 2000 || /[\s\\]/.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  if (!/^https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#].*)?$/.test(value)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
export function cardError(card) {
  for (const [key, label, max] of [['title','a title',120], ['cta','button text',60], ['eyebrow','a short label',80], ['body','a message',600]]) {
    if (typeof card[key] !== 'string' || card[key].length > max || (['title','cta'].includes(key) && !card[key].trim())) return `Add ${label}, up to ${max} characters.`;
    if (card[key].includes('—')) return 'Use a comma or sentence break instead of an em dash.';
  }
  if (!cardUrlOK(card.href)) return 'Use a full https:// link or a website path starting with /.';
  if (card.image && !cardUrlOK(card.image)) return 'Use an https:// image link or a website image path starting with /.';
  if (card.starts_on && card.ends_on && card.ends_on < card.starts_on) return 'The end date must be on or after the start date.';
  if (!['draft','published','archived'].includes(card.status)) return 'Choose a card status.';
  if (card.status === 'published' && !card.event_ids.length) return 'Choose at least one gallery before publishing.';
  if (!Number.isInteger(card.priority) || card.priority < 0 || card.priority > 999) return 'Card order must be a whole number from 0 to 999.';
  return '';
}
export function newGalleryCard(eventId = '') {
  return {title:'', eyebrow:'', body:'', cta:'Learn more', href:'', image:'', status:'draft', starts_on:'', ends_on:'', event_ids:eventId ? [eventId] : [], priority:0};
}
export function cardAsPromo(card) {
  const href = cardUrlOK(card.href) ? card.href : '/';
  return {...card, href, image:cardUrlOK(card.image) ? card.image : '', id:`custom-${card.id}`, external:href.startsWith('https://'), variants:[{eyebrow:card.eyebrow,title:card.title,body:card.body}]};
}
export function mergeGalleryCards(builtIns, library) {
  const replaced = new Set(['georgia-goal', 'trunk-booth-gallery', ...(library?.legacy_keys || [])]);
  return [...builtIns.filter(c => !replaced.has(c.id)), ...(library?.cards || []).map(cardAsPromo)];
}
