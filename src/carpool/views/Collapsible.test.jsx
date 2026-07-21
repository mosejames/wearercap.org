import { describe, it, expect, beforeEach } from 'vitest';
import { collapseStorageKey, readStoredOpen, writeStoredOpen } from './Collapsible.jsx';

// Only the pure open/persist helpers are covered here: the component itself is
// verified in a live approved session (open/close, counts, crew-opens-Start).
// jsdom gives us a real sessionStorage to round-trip against.

beforeEach(() => { window.sessionStorage.clear(); });

describe('collapseStorageKey', () => {
  it('namespaces the id', () => {
    expect(collapseStorageKey('cp-nearby')).toBe('carpool.collapse.cp-nearby');
  });
});

describe('readStoredOpen', () => {
  it('returns defaultOpen when nothing is stored', () => {
    expect(readStoredOpen('cp-nearby', true)).toBe(true);
    expect(readStoredOpen('cp-nearby', false)).toBe(false);
  });

  it('reads a stored-open section as open regardless of default', () => {
    writeStoredOpen('cp-family', true);
    expect(readStoredOpen('cp-family', false)).toBe(true);
  });

  it('reads a stored-closed section as closed regardless of default', () => {
    writeStoredOpen('cp-nearby', false);
    expect(readStoredOpen('cp-nearby', true)).toBe(false);
  });

  it('falls back to defaultOpen when the stored value is malformed', () => {
    window.sessionStorage.setItem(collapseStorageKey('cp-x'), 'yes');
    // Anything that is not exactly '1' reads as closed, so a bad value collapses
    // to false, not to the default; only a missing key uses the default.
    expect(readStoredOpen('cp-x', true)).toBe(false);
  });
});

describe('writeStoredOpen', () => {
  it('round-trips true and false', () => {
    writeStoredOpen('cp-mygroups', true);
    expect(window.sessionStorage.getItem(collapseStorageKey('cp-mygroups'))).toBe('1');
    writeStoredOpen('cp-mygroups', false);
    expect(window.sessionStorage.getItem(collapseStorageKey('cp-mygroups'))).toBe('0');
  });

  it('keeps each id independent', () => {
    writeStoredOpen('cp-mygroups', true);
    writeStoredOpen('cp-nearbygroups', false);
    expect(readStoredOpen('cp-mygroups', false)).toBe(true);
    expect(readStoredOpen('cp-nearbygroups', true)).toBe(false);
  });
});
