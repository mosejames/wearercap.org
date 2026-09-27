// @vitest-environment node
import crypto from 'node:crypto';
import { expect, it } from 'vitest';
import { photoIdFor, parseSession, verifySignature } from '../../api/booth-ingest.js';

const SECRET = 'test-webhook-secret';

it('derives a stable, valid UUID v5 per Snappic session id', () => {
  const a = photoIdFor('sess-123');
  const b = photoIdFor('sess-123');
  const c = photoIdFor('sess-456');
  expect(a).toBe(b);
  expect(a).not.toBe(c);
  expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

it('accepts a hex HMAC-SHA256 signature', () => {
  const raw = Buffer.from(JSON.stringify({ session: { id: 'x' } }));
  const sig = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  expect(verifySignature(raw, sig, SECRET)).toBe(true);
});

it('accepts a base64 HMAC-SHA256 signature', () => {
  const raw = Buffer.from('hello');
  const sig = crypto.createHmac('sha256', SECRET).update(raw).digest('base64');
  expect(verifySignature(raw, sig, SECRET)).toBe(true);
});

it('rejects a wrong signature, a missing secret, and a missing header', () => {
  const raw = Buffer.from('hello');
  expect(verifySignature(raw, 'deadbeef', SECRET)).toBe(false);
  expect(verifySignature(raw, crypto.createHmac('sha256', SECRET).update(raw).digest('hex'), '')).toBe(false);
  expect(verifySignature(raw, null, SECRET)).toBe(false);
});

it('parses the nested session shape and tolerates flat shapes', () => {
  expect(parseSession({ session: { id: 's1', type: 'photo', direct_url: 'https://x/y.jpg' }, event_id: 'e1' }))
    .toEqual({ directUrl: 'https://x/y.jpg', id: 's1', type: 'photo' });
  expect(parseSession({ session_id: 's2', direct_url: 'https://x/z.gif' }).id).toBe('s2');
  expect(parseSession(null)).toEqual({ directUrl: undefined, id: undefined, type: 'photo' });
});
