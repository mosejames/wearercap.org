import React, {useRef,useState} from 'react';
import {Photo,ListingVideo} from './ListingUI.jsx';
export default function Gallery({photos=[],video="",name}) {
 const [selected,setSelected]=useState(null),start=useRef(null);
 const media=[...photos,...(video?[video]:[])];
 const index=Math.max(0,media.indexOf(selected));
 const move=direction=>setSelected(media[(index+direction+media.length)%media.length]);
 return <div>
  <div className="dir-swipe-photo" role="group" aria-label="Listing photos and video" tabIndex={media.length>1?0:undefined}
   onKeyDown={e=>{if(e.target !== e.currentTarget || media.length<2)return;if(e.key==='ArrowRight'){e.preventDefault();move(1);}if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}}}
   onTouchStart={e=>{start.current=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;}}
   onTouchCancel={()=>{start.current=null;}}
   onTouchEnd={e=>{const point=start.current;start.current=null;if(!point || media.length<2 || !e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-point.x,dy=e.changedTouches[0].clientY-point.y;if(Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1);}}>
   {video && media[index]===video ? <ListingVideo key={video} path={video}/> : <Photo className="dir-main-photo" path={media[index]} name={`${name}${media.length ? `, photo ${index+1} of ${media.length}` : ''}`}/>}
  </div>
  {media.length>1 && <div className="dir-gallery-controls"><button type="button" aria-label="Previous image or video" onClick={()=>move(-1)}>‹</button><span aria-live="polite">{index+1} / {media.length}<small>Swipe to browse</small></span><button type="button" aria-label="Next image or video" onClick={()=>move(1)}>›</button></div>}
  <div className="dir-gallery">{photos.map((path,i)=><button type="button" key={path} aria-label={`View photo ${i+1}`} aria-pressed={index===i} onClick={()=>setSelected(path)}><Photo path={path} name={`${name}, photo ${i+1}`}/></button>)}{video && <button type="button" className="dir-video-thumbnail" aria-label="View video" aria-pressed={media[index]===video} onClick={()=>setSelected(video)}><span aria-hidden="true">▶</span><span>Video</span></button>}</div>
 </div>;
}
