import {describe,it,expect} from 'vitest';
import {newBlock,editableCardBlock,renderEmail,plainText,styleCheck} from './render.js';
const issue=block=>({subject:'Community update',blocks:[block]});
const legacy={id:'existing-note',type:'note',heading:'Things you may have missed.',kicker:'',body:'[Bingo Night](https://wearercap.org/rcap-capsule/#/e/bingo-night)\n\n[Chick-fil-A Night](https://wearercap.org/rcap-capsule/#/e/chick-fil-a-spirit-night)\n\n[Karaoke survey](https://wearercap.org/feedback/rb-karaoke)'};
describe('editable link cards',()=>{
 it('converts existing special cards without losing titles, copy, destinations or section identity',()=>{
  const result=editableCardBlock(legacy);expect(result.type).toBe('cards');expect(result.id).toBe(legacy.id);expect(result.items.map(i=>i.title)).toEqual(['Bingo Night','Chick-fil-A Night','Karaoke survey']);expect(result.items[2]).toMatchObject({action:'Take the survey',description:'Share your take in about 3 minutes.',url:'https://wearercap.org/feedback/rb-karaoke'});expect(editableCardBlock(result)).toBe(result);expect(renderEmail(issue(legacy))).toBe(renderEmail(issue(result)));
 });
 it('leaves ordinary notes alone',()=>{const note={...legacy,body:'A regular update'};expect(editableCardBlock(note)).toBe(note);});
 it('creates independent editable card identities',()=>{const a=newBlock('cards'),b=newBlock('cards');expect(new Set([...a.items,...b.items].map(i=>i.id)).size).toBe(6);});
 it('renders arbitrary card copy, escapes markup and supports two columns',()=>{
  const block={type:'cards',heading:'Family resources',columns:2,items:[{title:'<school>',icon:'📷',eyebrow:'New',description:'Our & your photos',action:'Open album',url:'https://example.org/album'},{title:'Survey',action:'Respond',url:'https://example.org/survey'}]};
  const html=renderEmail(issue(block));expect(html).toContain('min-width:50%');expect(html).toContain('width:calc((560px - 100%) * 1000)');expect(html).toContain('&lt;school&gt;');expect(html).toContain('Our &amp; your photos');expect(html).toContain('Open album');expect(html).toContain('https://example.org/album');expect(plainText(issue(block))).toContain('Open album: https://example.org/album');
 });
 it('disables unsafe destinations and warns before sending',()=>{const block={type:'cards',items:[{title:'Unsafe',action:'Go',url:'javascript:alert(1)'}]};const html=renderEmail(issue(block));expect(html).not.toContain('javascript:');expect(styleCheck(issue(block)).some(n=>n.kind==='link')).toBe(true);});
 it('uses full width for a single card and bounds long groups',()=>{const block={type:'cards',items:[{title:'One',url:'https://example.org'}]};expect(renderEmail(issue(block))).toContain('min-width:100%');block.items=Array.from({length:9},(_,i)=>({title:`Entry ${i}`,url:'https://example.org'}));expect(renderEmail(issue(block))).not.toContain('Entry 6');});
});

describe('embedded community cards',()=>{
 it('preserves the story and both actions as editable cards',()=>{
  const block={id:'community',type:'story',heading:'A place for you',body:'Thanks to our families.',button:{label:'Meet the Committees',url:'https://wearercap.org/board/#committees'},link:{label:'Still need to give?',url:'https://www.paypal.com/ncp/payment/EWP8R298MW83A'}};
  const result=editableCardBlock(block);expect(result.body).toBe(block.body);expect(result.cards.items).toHaveLength(2);expect(result.cards.items[0]).toMatchObject({icon:'team',action:'Explore the teams'});expect(result.button.url).toBe('');expect(editableCardBlock(result)).toBe(result);expect(renderEmail(issue(result))).toContain('committee-team-icon.png');expect(renderEmail(issue(result))).toContain('Thanks to our families.');expect(plainText(issue(result))).toContain('Membership donation: https://www.paypal.com/');
 });
});
