// @vitest-environment node
import {it,expect} from 'vitest';
import {cropRect,moveCrop,zoomCrop} from '../public/raffle-share/crop.js';
const image={w:2000,h:1200},area={w:500,h:500};
it('keeps the same photo point under the pinch midpoint',()=>{
 const state={zoom:1,x:1000,y:600},anchor={x:200,y:150};
 const before=cropRect(image,area,state),after=cropRect(image,area,zoomCrop(image,area,state,2,anchor));
 expect(before.x+anchor.x/before.scale).toBeCloseTo(after.x+anchor.x/after.scale);
 expect(before.y+anchor.y/before.scale).toBeCloseTo(after.y+anchor.y/after.scale);
});
it('keeps drag and zoom within the image without exposing blank edges',()=>{
 let state={zoom:1,x:1000,y:600};state=zoomCrop(image,area,state,100);expect(state.zoom).toBe(5);
 state=moveCrop(image,area,state,100000,-100000);const rect=cropRect(image,area,state);
 expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.y).toBeGreaterThanOrEqual(0);
 expect(rect.x+rect.w).toBeLessThanOrEqual(image.w);expect(rect.y+rect.h).toBeLessThanOrEqual(image.h);
 expect(zoomCrop(image,area,state,0.001).zoom).toBe(1);
});
