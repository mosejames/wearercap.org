import { describe, expect, it } from 'vitest';
import { FIRST_RAFFLE_DEADLINE, raffleTimeLeft } from './raffleCountdown.js';
describe('first raffle entry cutoff', () => {
  it('uses the confirmed Eastern deadline, not an invented Sunday drawing time', () => {
    expect(new Date(FIRST_RAFFLE_DEADLINE).toISOString()).toBe('2026-10-25T03:59:00.000Z');
    expect(raffleTimeLeft(FIRST_RAFFLE_DEADLINE - 90061000)).toEqual({ closed: false, days: 1, hours: 1, minutes: 1, seconds: 1 });
  });
  it('closes exactly at the cutoff and never shows negative time', () => {
    expect(raffleTimeLeft(FIRST_RAFFLE_DEADLINE)).toEqual({ closed: true, days: 0, hours: 0, minutes: 0, seconds: 0 });
    expect(raffleTimeLeft(FIRST_RAFFLE_DEADLINE + 86400000)).toEqual({ closed: true, days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
