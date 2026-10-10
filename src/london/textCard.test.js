import { expect, it } from 'vitest';
import { momentText, wrapCardText } from './textCard.js';
it('keeps written moments and optional quote attribution in the saved caption',()=>{expect(momentText({mode:'quote',text:'  This is amazing! ',speaker:'Mosie'})).toBe('This is amazing! (Mosie)');expect(momentText({mode:'thought',starter:'I can’t wait to…',text:'see London'})).toBe('I can’t wait to… see London');});
it('rejects empty and oversized written moments before any upload',()=>{expect(()=>momentText({mode:'comment',text:'   '})).toThrow();expect(()=>momentText({mode:'quote',text:'x'.repeat(221)})).toThrow();});
it('wraps even unbroken text inside the card and prevents blank-line overflow',()=>{const ctx={measureText:s=>({width:s.length*10})};expect(wrapCardText(ctx,'x'.repeat(220),100).every(line=>line.length<=10)).toBe(true);expect(wrapCardText(ctx,'hello\n\n\nworld',300)).toEqual(['hello world']);});
