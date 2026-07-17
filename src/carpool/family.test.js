import { describe, it, expect } from 'vitest';
import { buildFamilyRecord } from './family.js';

const base = {
  userId: 'u1',
  parentName: 'Pat Parent',
  childNames: 'Kid One, Kid Two',
  place: { formattedAddress: '123 Main St, College Park, GA 30349', lat: 33.65, lng: -84.44, postalCode: '30349' },
  areaGeocode: { lat: 33.66, lng: -84.49, label: '30349' },
  direction: 'both',
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  contactPhone: '404-555-0100',
  contactEmail: 'pat@example.com',
};

describe('buildFamilyRecord', () => {
  it('maps inputs to the families row shape', () => {
    const r = buildFamilyRecord(base);
    expect(r).toEqual({
      user_id: 'u1',
      parent_name: 'Pat Parent',
      child_names: 'Kid One, Kid Two',
      address: '123 Main St, College Park, GA 30349',
      lat: 33.65,
      lng: -84.44,
      area_lat: 33.66,
      area_lng: -84.49,
      area_label: '30349',
      direction: 'both',
      weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      contact_phone: '404-555-0100',
      contact_email: 'pat@example.com',
    });
  });

  it('allows a null phone', () => {
    const r = buildFamilyRecord({ ...base, contactPhone: '' });
    expect(r.contact_phone).toBeNull();
  });

  it('rejects an invalid direction', () => {
    expect(() => buildFamilyRecord({ ...base, direction: 'evening' })).toThrow();
  });

  it('rejects an empty weekdays list', () => {
    expect(() => buildFamilyRecord({ ...base, weekdays: [] })).toThrow();
  });

  it('rejects a weekday outside mon..fri', () => {
    expect(() => buildFamilyRecord({ ...base, weekdays: ['sun'] })).toThrow();
  });

  it('rejects a missing required field', () => {
    expect(() => buildFamilyRecord({ ...base, parentName: '' })).toThrow();
  });
});
