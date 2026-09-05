import { expect,it } from 'vitest';
import { normalizePhone } from './auth.js';
it('uses a consistent phone identity for US and international input',()=>{
 expect(normalizePhone('(404) 555-0123')).toBe('+14045550123');
 expect(normalizePhone('1 404 555 0123')).toBe('+14045550123');
 expect(normalizePhone('+44 7700 900123')).toBe('+447700900123');
 expect(()=>normalizePhone('123')).toThrow();
});
