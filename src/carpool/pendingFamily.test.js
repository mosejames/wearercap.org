import { describe, it, expect, beforeEach } from 'vitest';
import { stashPendingFamily, readPendingFamily, clearPendingFamily } from './pendingFamily.js';

const payload = {
  parentName: 'Pat Parent',
  childNames: 'Kid One',
  place: { formattedAddress: '1 Main St', lat: 33.6, lng: -84.4, postalCode: '30337' },
  areaGeocode: { lat: 33.66, lng: -84.49, label: '30337' },
  direction: 'both',
  weekdays: ['mon'],
  contactPhone: '',
  contactEmail: 'pat@example.com',
};

beforeEach(() => { window.sessionStorage.clear(); });

describe('pendingFamily', () => {
  it('returns null when nothing is stashed', () => {
    expect(readPendingFamily()).toBeNull();
  });
  it('round-trips a payload', () => {
    stashPendingFamily(payload);
    expect(readPendingFamily()).toEqual(payload);
  });
  it('clears the stash', () => {
    stashPendingFamily(payload);
    clearPendingFamily();
    expect(readPendingFamily()).toBeNull();
  });
  it('returns null and clears when the stash is malformed', () => {
    window.sessionStorage.setItem('carpool.pendingFamily', '{not json');
    expect(readPendingFamily()).toBeNull();
    expect(window.sessionStorage.getItem('carpool.pendingFamily')).toBeNull();
  });
});
