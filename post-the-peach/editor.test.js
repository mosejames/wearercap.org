import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createEditor } from './editor.js';
let canvas, editor, contexts, photo, artwork, state;
beforeEach(() => {
  contexts = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    if (!this.context) { this.context = Object.fromEntries(['clearRect','drawImage','save','restore','setLineDash','strokeRect','translate','rotate','beginPath','arc','fill','stroke','fillText'].map(name => [name,vi.fn()])); contexts.push(this.context); }
    return this.context;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback, type) { callback(new Blob(['jpeg'], { type })); });
  canvas = document.createElement('canvas'); canvas.setPointerCapture = vi.fn();
  canvas.getBoundingClientRect = () => ({ left:0,top:0,width:1080,height:1920 });
  photo = { naturalWidth:1080,naturalHeight:1920 }; artwork = { naturalWidth:1521,naturalHeight:306 };
  editor = createEditor(canvas, value => { state=value; }); editor.set(photo,artwork);
});
afterEach(() => vi.restoreAllMocks());
function pointer(type,x,y,id=1) { const e=new Event(type,{cancelable:true}); Object.assign(e,{clientX:x,clientY:y,pointerId:id}); canvas.dispatchEvent(e); }
const layers=()=>JSON.parse(state.composition).stickers;
function drag(s,dx,dy) { pointer('pointerdown',s.cx,s.cy); pointer('pointermove',s.cx+dx,s.cy+dy); pointer('pointerup',0,0); }
it('starts plain, adds independent stickers, and drags only the touched sticker',()=>{
  expect(state.count).toBe(0);expect(contexts[0].drawImage.mock.calls.at(-1)).toEqual([photo,0,0,1080,1920]);
  editor.addSticker();drag(layers()[0],-200,-900);const first=layers()[0];
  editor.addSticker({naturalWidth:1800,naturalHeight:850},'ami');const second=layers()[1];
  expect(state.count).toBe(2);drag(first,100,100);
  expect(layers()[0].cx).toBe(first.cx+100);expect(layers()[0].cy).toBe(first.cy+100);expect(layers()[1]).toEqual(second);expect(state.stickerKey).toBe('rca');editor.select('photo');editor.select('sticker');expect(state.stickerKey).toBe('rca');
});
it('pinches and twists the selected sticker without changing another sticker or the photo',()=>{
  editor.addSticker();drag(layers()[0],0,-900);const first=layers()[0];editor.addSticker(artwork,'reveur');const s=layers()[1];
  pointer('pointerdown',s.cx-80,s.cy,1);pointer('pointerdown',s.cx+80,s.cy,2);pointer('pointermove',s.cx+160,s.cy-100,2);
  const changed=layers()[1];expect(changed.w).toBeGreaterThan(s.w);expect(changed.angle).not.toBe(0);expect(layers()[0]).toEqual(first);expect(JSON.parse(state.composition).zoom).toBe(1);
  pointer('pointerup',0,0,1);pointer('pointerup',0,0,2);
  pointer('pointerdown',changed.cx,changed.cy);pointer('pointermove',changed.cx+20,changed.cy-20);pointer('pointerup',0,0);
  expect(layers()[1].cx).toBeCloseTo(changed.cx+20);
});
it('supports resizing and rotation with the round handle using one pointer',()=>{
  editor.addSticker();drag(layers()[0],0,-600);const s=layers()[0];const gx=s.cx+s.w/2,gy=s.cy+s.h/2;
  pointer('pointerdown',gx,gy);pointer('pointermove',s.cx+s.w*.6,s.cy+s.h*1.8);pointer('pointerup',0,0);
  expect(layers()[0].w).not.toBe(s.w);expect(layers()[0].angle).not.toBe(0);
});
it('exports every layer with its rotation, excluding all selection guides',async()=>{
  editor.addSticker();canvas.dispatchEvent(new KeyboardEvent('keydown',{key:']',cancelable:true}));
  const house={naturalWidth:1800,naturalHeight:850};editor.addSticker(house,'bindi');
  expect((await editor.export()).type).toBe('image/jpeg');const output=contexts[1];
  expect(output.drawImage.mock.calls.map(call=>call[0])).toEqual([photo,artwork,house]);expect(output.rotate.mock.calls[0][0]).toBeCloseTo(Math.PI/36);expect(output.strokeRect).not.toHaveBeenCalled();expect(output.arc).not.toHaveBeenCalled();
});
it('freezes all layers during submit, retains retry identity, and removes only the selected layer',()=>{
  editor.addSticker();editor.addSticker(artwork,'rizmo');const before=state.composition;
  editor.disable(true);editor.addSticker(artwork,'ami');editor.removeSticker();pointer('pointerdown',100,100);pointer('pointermove',200,200);expect(state.composition).toBe(before);
  editor.disable(false);expect(state.composition).toBe(before);editor.removeSticker();expect(state.count).toBe(1);expect(layers()[0].key).toBe('rca');expect(state.active).toBe('photo');
});
it('deletes a rotated sticker with its red X touch target, leaving other stickers intact',()=>{
  editor.addSticker();drag(layers()[0],0,-700);const first=layers()[0];editor.addSticker(artwork,'rizmo');
  canvas.dispatchEvent(new KeyboardEvent('keydown',{key:']',cancelable:true}));const s=layers()[1];
  const gx=s.cx-Math.cos(s.angle)*s.w/2+Math.sin(s.angle)*s.h/2,gy=s.cy-Math.sin(s.angle)*s.w/2-Math.cos(s.angle)*s.h/2;
  pointer('pointerdown',gx,gy);expect(state.count).toBe(1);expect(layers()[0]).toEqual(first);expect(state.active).toBe('photo');
});
