import { cropRect, moveCrop, zoomCrop } from './crop.js';
import { frameLayout, wrapName } from './layout.js';
const $ = id => document.getElementById(id);
const form = $('form');
const scholar = $('credit-name').textContent;
const family = form.elements.family.value;
const credit=[scholar,$('credit-class').textContent.replace(/^ · /,''),$('credit-house').textContent.replace(/^ · /,'')].filter(Boolean).join(' · ');
const params = new URLSearchParams(location.search);
const invitationId = params.get('id');
const message = `Help ${scholar} celebrate their awesome teachers! Every $1 raffle ticket supports RCAP’s efforts, including Teacher Appreciation Week. Please credit ${credit} at checkout.`;
let photo = null;
let busy = false;
let cropState={zoom:1,x:0,y:0};
const canvas = $('photo-preview');
const context = canvas.getContext('2d');
const crop = document.createElement('canvas'); crop.width=1300;crop.height=1164;
function roundRect(x,y,w,h,r,color) {context.fillStyle=color;context.beginPath();context.roundRect(x,y,w,h,r);context.fill();}
const backgrounds = {navy:new Image(),gold:new Image()};
for(const [key,img] of Object.entries(backgrounds)){img.onload=()=>draw();img.src=`/raffle-share/${key==='gold'?'golden-ticket-v1.jpg':'autumn-postcard-v1.jpg'}`;}
document.fonts.load('900 58px Figtree').then(()=>document.fonts.load('500 23px Figtree')).then(()=>draw());
function drawCrop() {
 if(!photo)return;
 const layout=frameLayout(form.elements.frame.value);crop.width=layout.photo.w*2;crop.height=layout.photo.h*2;
 const rect=cropRect({w:photo.width,h:photo.height},layout.photo,cropState);
 crop.getContext('2d').drawImage(photo,rect.x,rect.y,rect.w,rect.h,0,0,crop.width,crop.height);
}
function text(text,x,y,size,color,weight=900){context.fillStyle=color;context.font=`${weight} ${size}px Figtree,system-ui`;context.textBaseline='top';context.fillText(text,x,y);}
function draw() {
 const key=form.elements.frame.value==='gold'?'gold':'navy';const l=frameLayout(key,form.elements.scholar.value.trim(),form.elements.family.value.trim());
 context.fillStyle='#092847';context.fillRect(0,0,1200,630);
 if(backgrounds[key].complete && backgrounds[key].naturalWidth)context.drawImage(backgrounds[key],0,0,1200,630);
 const p=l.photo;const prompt=$('photo-prompt');prompt.style.left=`${p.x/12}%`;prompt.style.top=`${p.y/6.3}%`;prompt.style.width=`${p.w/12}%`;prompt.style.height=`${p.h/6.3}%`;prompt.style.right='auto';prompt.style.bottom='auto';
 const touch=$('photo-touch');Object.assign(touch.style,{left:prompt.style.left,top:prompt.style.top,width:prompt.style.width,height:prompt.style.height});
 context.save();context.beginPath();context.roundRect(p.x,p.y,p.w,p.h,16);context.clip();
 if(photo){drawCrop();context.drawImage(crop,p.x,p.y,p.w,p.h);}else{context.fillStyle='#f2e8d5';context.fillRect(p.x,p.y,p.w,p.h);}context.restore();
 text('RCAP FALL RAFFLE',l.x,l.brandY,22,l.accent);
 ['Help me celebrate','my awesome','teachers.'].forEach((line,i)=>text(line,l.x,l.headlineY+i*(l.headlineSize+1),l.headlineSize,i===2?l.accent:l.ink));
 wrapName(l.byline,l.gold?53:44).forEach((line,i)=>text(line,l.x,l.bylineY+i*(l.bylineSize+3),l.bylineSize,l.ink,500));
 l.supportLines.forEach((line,i)=>text(line,l.supportX,l.supportY+i*l.supportLeading,l.supportSize,l.ink,500));
 const t=l.ticket;
 if(l.gold){roundRect(t.x,t.y,t.w,t.h,7,'#102a49');text(l.ticketLabel,t.x+58,t.y+5,24,'#ffcf5a');}
 else{context.save();context.translate(t.x+t.w/2,t.y+t.h/2);context.rotate(-8*Math.PI/180);context.textAlign='center';text(l.ticketLabel,0,-15,28,'#102a49');context.restore();}
}
draw();
form.addEventListener('input',draw);
$('change-photo').onclick=()=>$('photo-input').click();
$('photo-input').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;
 if(file.size>25000000){$('create-status').textContent='Please choose a photo smaller than 25 MB.';return;}
 const url=URL.createObjectURL(file);const image=new Image();
 image.onload=()=>{photo=image;URL.revokeObjectURL(url);$('photo-prompt').hidden=true;$('crop-controls').hidden=false;$('change-photo').textContent='Change photo';cropState={zoom:1,x:image.width/2,y:image.height/2};$('photo-touch').hidden=false;$('create-status').textContent='';draw();};
 image.onerror=()=>{URL.revokeObjectURL(url);$('create-status').textContent='This photo could not be opened. Try a JPG, PNG or WebP photo, or a screenshot of your photo.';};
 image.src=url;
});
const touch=$('photo-touch');const pointers=new Map();let gesture=null;
function point(event){const rect=touch.getBoundingClientRect();const area=frameLayout(form.elements.frame.value).photo;return{x:(event.clientX-rect.left)*area.w/rect.width,y:(event.clientY-rect.top)*area.h/rect.height};}
function snapshot(){const points=[...pointers.values()];return points.length>1?{center:{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2},distance:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)}:points.length?{center:points[0],distance:0}:null;}
touch.addEventListener('pointerdown',event=>{if(!photo)return;event.preventDefault();touch.setPointerCapture(event.pointerId);pointers.set(event.pointerId,point(event));gesture=snapshot();});
touch.addEventListener('pointermove',event=>{
 if(!pointers.has(event.pointerId)||!photo)return;event.preventDefault();pointers.set(event.pointerId,point(event));const next=snapshot();const image={w:photo.width,h:photo.height},area=frameLayout(form.elements.frame.value).photo;
 if(gesture&&next){if(gesture.distance>0&&next.distance>0)cropState=zoomCrop(image,area,cropState,next.distance/gesture.distance,gesture.center);cropState=moveCrop(image,area,cropState,next.center.x-gesture.center.x,next.center.y-gesture.center.y);draw();}gesture=next;
});
function release(event){pointers.delete(event.pointerId);gesture=snapshot();}
for(const type of ['pointerup','pointercancel','lostpointercapture'])touch.addEventListener(type,release);
touch.addEventListener('wheel',event=>{if(!photo)return;event.preventDefault();cropState=zoomCrop({w:photo.width,h:photo.height},frameLayout(form.elements.frame.value).photo,cropState,Math.exp(-event.deltaY*0.003),point(event));draw();},{passive:false});
touch.addEventListener('keydown',event=>{
 if(!photo)return;const image={w:photo.width,h:photo.height},area=frameLayout(form.elements.frame.value).photo;
 const movement={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}[event.key];
 if(movement){event.preventDefault();cropState=moveCrop(image,area,cropState,...movement);draw();}
 if(['+','=','-'].includes(event.key)){event.preventDefault();cropState=zoomCrop(image,area,cropState,event.key==='-'?1/1.15:1.15);draw();}
});
$('reset-photo').onclick=()=>{if(photo){cropState={zoom:1,x:photo.width/2,y:photo.height/2};draw();}};
form.addEventListener('submit', async event => {
 event.preventDefault();if(busy)return;
 if(!photo){$('create-status').textContent='Choose a photo of your scholar or family first.';return;}
 busy=true;$('create-button').disabled=true;$('create-button').textContent='Creating your invitation…';$('create-status').textContent='Saving your photo card. This may take a moment.';
 try {
 drawCrop();const image=crop.toDataURL('image/jpeg',0.85);
 const response=await fetch('/api/raffle-photo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,scholar:form.elements.scholar.value.trim(),family:form.elements.family.value.trim(),classYear:form.elements.classYear.value,house:form.elements.house.value,frame:form.elements.frame.value})});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save your invitation.');
 try{localStorage.setItem(`rcap-raffle-${result.id}`,result.token);}catch{}
 location.href=result.url;
 }catch(error){$('create-status').textContent=error.message||'Could not save your invitation. Please try again.';busy=false;$('create-button').disabled=false;$('create-button').textContent='Create my photo invitation';}
});
async function copy(text, success) {
 try { await navigator.clipboard.writeText(text); $('share-status').textContent = success; }
 catch { $('share-status').textContent = 'Copy the invitation link from your browser’s address bar.'; }
}
$('copy').onclick = () => copy(location.href, 'Invitation link copied. Ready to send!');
$('copy-name').onclick = () => copy(credit, 'Student’s name, class and house copied. Paste them into the raffle checkout.');
$('share').onclick = async () => {
 if (!navigator.share) return copy(`${message} ${location.href}`, 'Invitation and link copied. Paste them into your message.');
 try { await navigator.share({title:`Support ${scholar} in the RCAP Fall Raffle`,text:message,url:location.href}); }
 catch (error) { if(error.name !== 'AbortError') await copy(`${message} ${location.href}`,'Invitation copied. Ready to send!'); }
};
$('download').onclick = async () => {
 const button = $('download'); button.disabled = true;
 try {
 const saved=$('finished-photo');
 const image = await fetch(saved ? saved.src : `/api/vault-og?card=raffle-share&${new URLSearchParams({scholar,family})}`);
 if(!image.ok) throw new Error('Image unavailable');
 const blob = await image.blob(); const url = URL.createObjectURL(blob);
 const a = document.createElement('a'); a.href=url; a.download=`rcap-fall-raffle-invitation.${saved?'jpg':'png'}`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
 $('share-status').textContent='Card saved. Send it with your invitation link so friends can buy tickets.';
 } catch { $('share-status').textContent='The card could not be saved. You can still share your invitation link.'; }
 finally { button.disabled=false; }
};
$('edit').onclick = () => { $('creator').hidden=false; $('invitation').hidden=true; draw();$('change-photo').focus(); window.scrollTo(0,0); };
let ownerToken;try{ownerToken=invitationId&&localStorage.getItem(`rcap-raffle-${invitationId}`);}catch{}
if(ownerToken)$('hide').hidden=false;
$('hide').onclick=async()=>{
 $('hide').disabled=true;
 try{
 const response=await fetch('/api/raffle-photo',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:invitationId,token:ownerToken})});
 if(!response.ok)throw new Error('Could not hide your invitation. Please try again.');
 location.href=location.pathname;
 }catch(error){$('share-status').textContent=error.message;$('hide').disabled=false;}
};
