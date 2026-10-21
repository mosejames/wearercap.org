const $ = id => document.getElementById(id);
const form = $('form');
const params = new URLSearchParams(location.search);
const scholar = params.get('scholar') || '';
const family = params.get('family') || '';
const message = `Our family is cheering on ${scholar} in the RCAP Fall Raffle! Tickets are $1 and support Teacher Appreciation Week. Please credit ${scholar} at checkout. ${location.href}`;
form.addEventListener('submit', event => {
 event.preventDefault();
 const data = new FormData(form);
 const name = String(data.get('scholar')).trim();
 const familyName = String(data.get('family')).trim();
 if (!name || !familyName) return;
 location.href = `${location.pathname}?${new URLSearchParams({scholar:name,family:familyName})}`;
});
async function copy(text, success) {
 try { await navigator.clipboard.writeText(text); $('share-status').textContent = success; }
 catch { $('share-status').textContent = 'Copy the invitation link from your browser’s address bar.'; }
}
$('copy').onclick = () => copy(location.href, 'Invitation link copied. Ready to send!');
$('copy-name').onclick = () => copy(scholar, 'Scholar’s name copied. Paste it into the raffle checkout.');
$('share').onclick = async () => {
 if (!navigator.share) return copy(message, 'Invitation and link copied. Paste them into your message.');
 try { await navigator.share({title:`Support ${scholar} in the RCAP Fall Raffle`,text:message.replace(` ${location.href}`,''),url:location.href}); }
 catch (error) { if(error.name !== 'AbortError') await copy(message,'Invitation copied. Ready to send!'); }
};
$('download').onclick = async () => {
 const button = $('download'); button.disabled = true;
 try {
 const image = await fetch(`/api/vault-og?card=raffle-share&${new URLSearchParams({scholar,family})}`);
 if(!image.ok) throw new Error('Image unavailable');
 const blob = await image.blob(); const url = URL.createObjectURL(blob);
 const a = document.createElement('a'); a.href=url; a.download='rcap-fall-raffle-invitation.png'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
 $('share-status').textContent='Card saved. Send it with your invitation link so friends can buy tickets.';
 } catch { $('share-status').textContent='The card could not be saved. You can still share your invitation link.'; }
 finally { button.disabled=false; }
};
$('edit').onclick = () => { $('creator').hidden=false; $('invitation').hidden=true; form.elements.scholar.focus(); window.scrollTo(0,0); };
