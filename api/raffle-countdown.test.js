// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from './vault-og.js';
import { FIRST_RAFFLE_DEADLINE } from '../src/events/raffleCountdown.js';
afterEach(() => vi.restoreAllMocks());
describe('raffle countdown image', () => {
  it('returns a real PNG without caching, including after entry closes', async () => {
    for (const now of [FIRST_RAFFLE_DEADLINE - 3600000, FIRST_RAFFLE_DEADLINE + 1]) {
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const headers = {};
      const res = { setHeader: (key, value) => { headers[key] = value; }, status: vi.fn().mockReturnThis(), send: vi.fn() };
      await handler({ query: { card: 'raffle-countdown' } }, res);
      const png = res.send.mock.calls[0][0];
      expect(res.status).toHaveBeenCalledWith(200);
      expect(headers['Content-Type']).toBe('image/png');
      expect(headers['Cache-Control']).toContain('no-store');
      expect(headers['Vercel-CDN-Cache-Control']).toBe('no-store');
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([588, 184]);
    }
  });
});
