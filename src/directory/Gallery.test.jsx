import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
vi.mock('./ListingUI.jsx',()=>({Photo:({path,name})=><img src={path} alt={name}/>}));
import Gallery from './Gallery.jsx';
it('swipes through photos, wraps around, and leaves vertical scrolling alone',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div'),root=createRoot(host);
 try{
 await act(async()=>root.render(<Gallery photos={['one','two','three']} name="Business"/>));
 const surface=host.querySelector('[role=group]');
 const swipe=async(x,y)=>{await act(async()=>{const start=new Event('touchstart',{bubbles:true});Object.defineProperty(start,'touches',{value:[{clientX:100,clientY:100}]});surface.dispatchEvent(start);const end=new Event('touchend',{bubbles:true});Object.defineProperty(end,'changedTouches',{value:[{clientX:x,clientY:y}]});surface.dispatchEvent(end);});};
 await swipe(10,105);expect(surface.querySelector('img').getAttribute('src')).toBe('two');
 await swipe(110,220);expect(surface.querySelector('img').getAttribute('src')).toBe('two');
 await swipe(10,105);await swipe(10,105);expect(surface.querySelector('img').getAttribute('src')).toBe('one');
 await swipe(200,105);expect(surface.querySelector('img').getAttribute('src')).toBe('three');
 }finally{await act(async()=>root.unmount());}
});
