import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const script=readFileSync('public/mobile-entry.js','utf8');
function visit({ua='Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)',path='/',search='',hash='',pref=null,blocked=false,touch=1,mobileHint=false}={}) {
  let stored=pref, destination=null;
  const location={pathname:path,search,hash,replace(value){destination=value;}};
  const storage={getItem(){if(blocked)throw Error('blocked');return stored;},setItem(_key,value){if(blocked)throw Error('blocked');stored=value;},removeItem(){stored=null;}};
  runInNewContext(script,{URLSearchParams,window:{location,localStorage:storage,navigator:{userAgent:ua,maxTouchPoints:touch,userAgentData:{mobile:mobileHint}}}});
  return {destination,stored};
}
describe('Mobile homepage entry',()=>{
 it('sends phone and tablet homepage visitors to the hub',()=>{
  expect(visit().destination).toBe('/app/');
  expect(visit({ua:'Mozilla/5.0 Android 16 Mobile'}).destination).toBe('/app/');
  expect(visit({ua:'Mozilla/5.0 Macintosh',touch:5}).destination).toBe('/app/');
 });
 it('keeps desktop visitors on the full website',()=>expect(visit({ua:'Mozilla/5.0 Macintosh',touch:0}).destination).toBeNull());
 it('remembers full-site choice and avoids a redirect loop',()=>{
  expect(visit({search:'?view=full'})).toEqual({destination:null,stored:'full'});
  expect(visit({pref:'full'}).destination).toBeNull();
 });
 it('honors the full-site URL even when storage is unavailable',()=>expect(visit({search:'?view=full',blocked:true}).destination).toBeNull());
 it('lets people choose the hub again and clears the old preference',()=>expect(visit({search:'?view=app',pref:'full'})).toEqual({destination:'/app/',stored:null}));
 it('preserves section links, tools, gallery links, and the app itself',()=>{
  expect(visit({hash:'#serve'}).destination).toBeNull();
  for(const path of ['/app/','/newsletter','/rcap-capsule/e/bingo-night','/uniform-exchange/']) expect(visit({path}).destination).toBeNull();
 });
 it('retains campaign parameters when entering the hub',()=>expect(visit({search:'?utm_source=welcome&campaign=family'}).destination).toBe('/app/?utm_source=welcome&campaign=family'));
});
