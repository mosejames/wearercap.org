// The committee confirmed the entry deadline, but no drawing start time.
export const FIRST_RAFFLE_DEADLINE = Date.parse('2026-10-24T23:59:00-04:00');
export const RAFFLE_TICKET_URL = 'https://www.zeffy.com/en-US/ticketing/ron-clark-academy-parents-fall-fundraiser--2026';
export const RAFFLE_DETAILS_URL = 'https://wearercap.org/events/2026/fall-raffle/';
export const RAFFLE_COUNTDOWN_URL = `${RAFFLE_DETAILS_URL}countdown.png`;
export function raffleTimeLeft(now = Date.now()) {
  const remaining = Math.max(0, Math.ceil((FIRST_RAFFLE_DEADLINE - now) / 1000));
  return {
    closed: now >= FIRST_RAFFLE_DEADLINE,
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
  };
}
