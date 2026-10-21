const $ = id => document.getElementById(id);
const form = $('form');
const scholar = $('credit-name').textContent;
const family = form.elements.family.value;
const params = new URLSearchParams(location.search);
const invitationId = params.get('id');
const message = `Our family is cheering on ${scholar} in the RCAP Fall Raffle! Tickets are $1 and support Teacher Appreciation Week. Please credit ${scholar} at checkout.`;
let photo = null;
let busy = false;
const canvas = $('photo-preview');
const context = canvas.getContext('2d');
const crop = document.createElement('canvas'); crop.width=1300;crop.height=1164;
function roundRect(x,y,w,h,r,color) {context.fillStyle=color;context.beginPath();context.roundRect(x,y,w,h,r);context.fill();}
function lines(text,x,y,maxWidth,size,color,weight=800,lineHeight=1.1,maxLines=3) {
 context.fillStyle=color;context.font=`${weight} ${size}px system-ui`;
 const words=text.split(' ');let line='';let count=0;
 for(const word of words){const next=line?`${line} ${word}`:word;if(context.measureText(next).width>maxWidth && line){context.fillText(line,x,y);y+=size*lineHeight;count++;line=word;if(count>=maxLines-1)break;}else line=next;}
 // Names are capped and the font shrinks for long input, keeping the preview tidy.
 context.fillText(line,x,y);return y+size*lineHeight;
}
function drawCrop() {
 if(!photo)return;
 const zoom=Number($('zoom').value);const fit=Math.max(crop.width/photo.width,crop.height/photo.height)*zoom;
 const width=crop.width/fit,height=crop.height/fit;
 crop.getContext('2d').drawImage(photo,(photo.width-width)*Number($('pan-x').value),(photo.height-height)*Number($('pan-y').value),width,height,0,0,crop.width,crop.height);
}
function draw() {
 const gold=form.elements.frame.value==='gold';const bg=gold?'#edb744':'#1b2c56',ink=gold?'#1b2c56':'#faf4ea',accent=gold?'#1b2c56':'#f7a81c';
 context.fillStyle=bg;context.fillRect(0,0,1200,630);
 context.save();context.beginPath();context.roundRect(24,24,650,582,14);context.clip();
 if(photo){drawCrop();context.drawImage(crop,24,24,650,582);}else{context.fillStyle=gold?'#fae3a5':'#e9e1d1';context.fillRect(24,24,650,582);}context.restore();
 lines('RCAP FALL RAFFLE',706,68,440,20,accent,900);
 const name=form.elements.scholar.value.trim()||'your scholar';const last=form.elements.family.value.trim();
 lines(last ? `The ${last} family invites you` : 'Your family invites you',706,163,438,last.length>25?18:22,ink,500,1.2,3);
 lines(`Cheer on ${name}.`,706,270,438,name.length>25?32:43,ink,900,1.12,3);
 lines('Give our teachers a little love.',706,410,438,28,ink,800,1.15,2);
 roundRect(706,482,438,60,8,accent);lines('Buy $1 raffle tickets',728,522,400,28,bg,900);
 lines('Supporting Teacher Appreciation Week',706,574,440,17,ink,500);lines('wearercap.org',706,603,438,16,ink,500);
}
draw();
form.addEventListener('input',draw);
$('change-photo').onclick=()=>$('photo-input').click();
$('photo-input').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;
 if(file.size>25000000){$('create-status').textContent='Please choose a photo smaller than 25 MB.';return;}
 const url=URL.createObjectURL(file);const image=new Image();
 image.onload=()=>{photo=image;URL.revokeObjectURL(url);$('photo-prompt').hidden=true;$('crop-controls').hidden=false;$('change-photo').textContent='Change photo';$('zoom').value='1';$('pan-x').value='0.5';$('pan-y').value='0.5';$('create-status').textContent='';draw();};
 image.onerror=()=>{URL.revokeObjectURL(url);$('create-status').textContent='This photo could not be opened. Try a JPG, PNG or WebP photo, or a screenshot of your photo.';};
 image.src=url;
});
form.addEventListener('submit', async event => {
 event.preventDefault();if(busy)return;
 if(!photo){$('create-status').textContent='Choose a photo of your scholar or family first.';return;}
 busy=true;$('create-button').disabled=true;$('create-button').textContent='Creating your invitation…';$('create-status').textContent='Saving your photo card. This may take a moment.';
 try {
 drawCrop();const image=crop.toDataURL('image/jpeg',0.85);
 const response=await fetch('/api/raffle-photo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,scholar:form.elements.scholar.value.trim(),family:form.elements.family.value.trim(),frame:form.elements.frame.value})});
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
$('copy-name').onclick = () => copy(scholar, 'Scholar’s name copied. Paste it into the raffle checkout.');
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
