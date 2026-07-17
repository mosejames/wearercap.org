import { describe, it, expect } from 'vitest';
import { resolveView } from './auth.js';

describe('resolveView', () => {
  it('returns signed-out when there is no session', () => {
    expect(resolveView(null, null)).toBe('signed-out');
  });

  it('returns pending when signed in but no member row yet', () => {
    expect(resolveView({ user: { id: 'u1' } }, null)).toBe('pending');
  });

  it('returns pending when member approval is pending', () => {
    expect(resolveView({ user: { id: 'u1' } }, { approval: 'pending', role: 'parent' })).toBe('pending');
  });

  it('returns ready for an approved parent', () => {
    expect(resolveView({ user: { id: 'u1' } }, { approval: 'approved', role: 'parent' })).toBe('ready');
  });

  it('returns admin for an approved admin', () => {
    expect(resolveView({ user: { id: 'u1' } }, { approval: 'approved', role: 'admin' })).toBe('admin');
  });

  it('treats an unapproved admin as pending', () => {
    expect(resolveView({ user: { id: 'u1' } }, { approval: 'pending', role: 'admin' })).toBe('pending');
  });
});
