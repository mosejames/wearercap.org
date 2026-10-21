const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function cropRect(image,area,state) {
 const scale=Math.max(area.w/image.w,area.h/image.h)*state.zoom;
 const w=area.w/scale,h=area.h/scale;
 const x=clamp(state.x-w/2,0,Math.max(0,image.w-w)),y=clamp(state.y-h/2,0,Math.max(0,image.h-h));
 return {x,y,w,h,scale};
}
export function moveCrop(image,area,state,dx,dy) {
 const rect=cropRect(image,area,state);
 const next={...state,x:rect.x+rect.w/2-dx/rect.scale,y:rect.y+rect.h/2-dy/rect.scale};
 const bounded=cropRect(image,area,next);return {...next,x:bounded.x+bounded.w/2,y:bounded.y+bounded.h/2};
}
export function zoomCrop(image,area,state,factor,anchor={x:area.w/2,y:area.h/2}) {
 const before=cropRect(image,area,state);const zoom=clamp(state.zoom*factor,1,5);
 const after=cropRect(image,area,{...state,zoom});
 const x=before.x+anchor.x/before.scale-anchor.x/after.scale+after.w/2;
 const y=before.y+anchor.y/before.scale-anchor.y/after.scale+after.h/2;
 const bounded=cropRect(image,area,{zoom,x,y});return{zoom,x:bounded.x+bounded.w/2,y:bounded.y+bounded.h/2};
}
