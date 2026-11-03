import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const html=readFileSync(process.cwd()+'/post-the-peach/index.html','utf8');
let output,fetchMock,urlMock,revokeMock;
beforeEach(async()=>{
 document.body.innerHTML=html;
 output=new Blob(['finished photo and stickers'],{type:'image/jpeg'});
 let counter=0;urlMock=vi.fn(()=>`blob:test-${++counter}`);revokeMock=vi.fn();
 vi.stubGlobal('URL',class extends URL { static createObjectURL=urlMock;static revokeObjectURL=revokeMock; });
 vi.stubGlobal('Image',class { naturalWidth=1080;naturalHeight=1920;set src(value){queueMicrotask(()=>this.onload?.());} });
 fetchMock=vi.fn(async()=>({ok:true,json:async()=>({ok:true})}));vi.stubGlobal('fetch',fetchMock);
 const editor={set:vi.fn(),clear:vi.fn(),disable:vi.fn(),export:vi.fn(async()=>output)};
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/import \{createEditor\} from "\.\/editor.js";/,'');
 new Function('createEditor',script)(()=>editor);
 const input=document.getElementById('file');Object.defineProperty(input,'files',{value:[new File(['source'],'source.jpg',{type:'image/jpeg'})]});input.dispatchEvent(new Event('change'));
 await vi.waitFor(()=>expect(document.getElementById('preview').hidden).toBe(false));
 document.getElementById('consent').checked=true;
});
afterEach(()=>{vi.unstubAllGlobals();document.body.innerHTML='';});
async function submit(){await document.getElementById('preview').onsubmit(new Event('submit',{cancelable:true}));}
it('offers the exact uploaded JPEG as a personal download only after saving privately',async()=>{
 expect(document.getElementById('download-photo').hidden).toBe(true);await submit();
 const link=document.getElementById('download-photo');expect(link.hidden).toBe(false);expect(link.download).toMatch(/^post-the-peach-.*\.jpg$/);
 expect(fetchMock.mock.calls[0][1].body).toBe(output);expect(urlMock.mock.calls.at(-1)[0]).toBe(output);expect(link.getAttribute('href')).toBe('blob:test-2');expect(document.getElementById('done').hidden).toBe(false);
 document.getElementById('another').onclick();expect(revokeMock).toHaveBeenCalledWith('blob:test-2');expect(link.hasAttribute('href')).toBe(false);expect(link.hidden).toBe(true);
});
it('does not offer a download or saved confirmation when the private upload fails, and permits retry',async()=>{
 fetchMock.mockResolvedValueOnce({ok:false,json:async()=>({error:'Please retry.'})});await submit();
 expect(document.getElementById('download-photo').hidden).toBe(true);expect(document.getElementById('done').hidden).toBe(true);expect(document.getElementById('preview').hidden).toBe(false);expect(document.getElementById('error').textContent).toBe('Please retry.');
 await submit();expect(document.getElementById('download-photo').hidden).toBe(false);expect(fetchMock.mock.calls[1][1].headers['X-Photo-ID']).toBe(fetchMock.mock.calls[0][1].headers['X-Photo-ID']);
});

it('opens the phone share sheet with the finished JPEG and never a public URL',async()=>{
 const share=vi.fn(async()=>{});Object.defineProperty(navigator,'share',{configurable:true,value:share});Object.defineProperty(navigator,'canShare',{configurable:true,value:vi.fn(()=>true)});
 await submit();await document.getElementById('save-photo').onclick();
 const data=share.mock.calls[0][0];expect(Object.keys(data)).toEqual(['files']);expect(data.files[0].type).toBe('image/jpeg');expect(data.files[0].size).toBe(output.size);expect(document.getElementById('saved-photo').hidden).toBe(true);
 delete navigator.share;delete navigator.canShare;
});
it('uses a touch-and-hold photo fallback without triggering a browser download',async()=>{
 await submit();await document.getElementById('save-photo').onclick();
 expect(document.getElementById('saved-photo').hidden).toBe(false);expect(document.getElementById('saved-photo').getAttribute('src')).toBe('blob:test-2');expect(document.getElementById('save-help').textContent).toContain('Touch and hold');
});
it('leaves the photo available after cancelling the share sheet without pretending it was saved',async()=>{
 Object.defineProperty(navigator,'share',{configurable:true,value:vi.fn(async()=>{throw new DOMException('Cancelled','AbortError');})});Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
 await submit();await document.getElementById('save-photo').onclick();expect(document.getElementById('saved-photo').hidden).toBe(true);expect(document.getElementById('save-photo').disabled).toBe(false);expect(document.getElementById('done').hidden).toBe(false);
 delete navigator.share;delete navigator.canShare;
});
