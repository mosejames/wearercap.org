import { describe, it, expect } from 'vitest';
import { scheduleOverlap } from './compatibility.js';

describe('scheduleOverlap copy', () => {
  it('compares both directions with a morning-only family and orders weekdays', () => {
    expect(scheduleOverlap({ direction: 'both', weekdays: ['thu', 'tue'] }, { direction: 'am', weekdays: ['tue', 'thu', 'fri'] }))
      .toBe('You both listed Tue, Thu morning rides');
  });
  it('does not imply compatibility for opposite ride directions', () => {
    expect(scheduleOverlap({ direction: 'am', weekdays: ['mon'] }, { direction: 'pm', weekdays: ['mon'] }))
      .toBe('No shared ride times listed');
  });
  it('does not imply compatibility for different weekdays or missing schedules', () => {
    expect(scheduleOverlap({ direction: 'both', weekdays: ['mon'] }, { direction: 'both', weekdays: ['fri'] }))
      .toBe('No shared ride times listed');
    expect(scheduleOverlap({}, {})).toBe('No shared ride times listed');
  });
});
