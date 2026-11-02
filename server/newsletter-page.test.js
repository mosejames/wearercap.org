import {it,expect,vi,afterEach} from 'vitest';
import newsletterPage,{shareImage} from './newsletter-page.js';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('uses a separate square share image without changing body images or winner copy',async()=>{
 vi.stubEnv('VITE_SUPABASE_URL','https://fictional.invalid');vi.stubEnv('VITE_SUPABASE_ANON_KEY','fictional');
 const c={subject:'Meet Our Raffle & Little Boo Winners!',preheader:'Meet Our Raffle & Little Boo Winners!',shareImage:{url:'https://wearercap.org/images/newsletter/winners-are-in-square.png',width:1080,height:1080,alt:'THE WINNERS ARE IN!'},blocks:[{type:'story',heading:'Body unchanged',image:{url:'https://example.com/original.jpg',alt:'Original image'}}]};
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({slug:'fictional-issue',content:c})})));
 let html='';const res={setHeader:vi.fn(),status:vi.fn().mockReturnThis(),send:x=>{html=x;}};
 await newsletterPage({query:{v:'fictional-issue'}},res);
 expect(html).toContain('property="og:image" content="'+c.shareImage.url+'"');
 expect(html).toContain('property="og:image:width" content="1080"');expect(html).toContain('property="og:image:height" content="1080"');
 expect(html).toContain('name="twitter:image" content="'+c.shareImage.url+'"');
 expect(html).toContain('Meet Our Raffle &amp; Little Boo Winners!');expect(html).toContain('https://example.com/original.jpg');expect(html).not.toContain('og:video');
});
it('rejects unsafe or invalid overrides and preserves ordinary newsletters',()=>{
 const blocks=[{image:{url:'https://example.com/original.jpg'}}];
 for(const share of [{url:'javascript:alert(1)',width:1080,height:1080},{url:'https://example.com/test.png',width:'1080',height:1080}])expect(shareImage({blocks,shareImage:share}).url).toBe(blocks[0].image.url);
});
