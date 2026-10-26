import {afterEach,it,expect,vi} from 'vitest';
import {encode,decode,initialInvite,secureEqual,hash} from './storage.js';
afterEach(()=>vi.unstubAllEnvs());
it('encrypts recipient details and rejects tampered job state',()=>{vi.stubEnv('NYC_EXPORT_KEY','a'.repeat(64));const bytes=encode({email:'staff@example.com'});expect(bytes.toString()).not.toContain('staff@example.com');expect(decode(bytes)).toEqual({email:'staff@example.com'});bytes[bytes.length-1]^=1;expect(()=>decode(bytes)).toThrow();});
it('uses a separate unguessable invitation and constant-time token comparison',()=>{vi.stubEnv('NYC_EXPORT_KEY','a'.repeat(64));const invite=initialInvite();expect(invite).toMatch(/^[a-f0-9]{64}$/);expect(invite).not.toBe('a'.repeat(64));expect(secureEqual(invite,invite)).toBe(true);expect(secureEqual(invite,hash('other'))).toBe(false);});
