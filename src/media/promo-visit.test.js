import { beforeEach, it, expect, vi } from 'vitest';
import { markPromoSeen, hasSeenPromo } from './promo-visit.js';
beforeEach(() => {
 const data = new Map();
 vi.stubGlobal('sessionStorage', { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) });
});
it('suppresses the homepage invitation after visiting either video experience', () => {
 expect(hasSeenPromo()).toBe(false);
 markPromoSeen();
 expect(hasSeenPromo()).toBe(true);
});
it('does not break navigation when storage is unavailable', () => {
 vi.stubGlobal('sessionStorage', {getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}});
 expect(() => markPromoSeen()).not.toThrow();
 expect(hasSeenPromo()).toBe(false);
});
