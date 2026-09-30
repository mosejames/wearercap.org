import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('M3 storage configuration', () => {
  it('uses the shared R2 configuration used by the other vaults', async () => {
    vi.stubEnv('R2_ACCOUNT_ID', 'account');
    vi.stubEnv('R2_ACCESS_KEY_ID', 'key');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('R2_BUCKET', 'rcap-vault-media');
    vi.stubEnv('R2_PUBLIC_BASE', 'https://media.wearercap.org/');
    vi.stubEnv('M3_STORAGE', '');
    vi.stubEnv('M3_R2_ACCOUNT_ID', '');
    vi.stubEnv('M3_R2_ACCESS_KEY_ID', '');
    vi.stubEnv('M3_R2_SECRET_ACCESS_KEY', '');
    vi.stubEnv('M3_R2_BUCKET', '');
    vi.stubEnv('M3_R2_PUBLIC_BASE', '');

    const { mode } = await import('./m3-sign.js');

    expect(mode()).toBe('r2');
  });

  it('keeps an explicit M3 storage choice authoritative', async () => {
    vi.stubEnv('R2_ACCOUNT_ID', 'account');
    vi.stubEnv('R2_ACCESS_KEY_ID', 'key');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('R2_PUBLIC_BASE', 'https://media.wearercap.org');
    vi.stubEnv('M3_STORAGE', 'supabase');

    const { mode } = await import('./m3-sign.js');

    expect(mode()).toBe('supabase');
  });
});
