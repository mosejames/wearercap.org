const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function lines(text){const result=[''];for(const word of String(text).split(/\s+/)){for(const part of word.match(/.{1,24}/g)||['']){const i=result.length-1;if((result[i]+' '+part).length>24&&result[i])result.push(part);else result[i]=(result[i]+' '+part).trim();}}return result.slice(0,3);}
export function shareSvg(t){
 const color=(s,f)=>/^#[a-f0-9]{6}$/i.test(s||'')?s:f;
 const navy=color(t.colors?.navy,'#102448'),gold=color(t.colors?.yellow,'#f5cc48'),paper=color(t.colors?.paper,'#faf9f4');
 const image=(data,x,y,width,height,fit='xMidYMid meet')=>/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(data||'')?`<image href="${data}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${fit}"/>`:'';
 const title=lines(t.destination||'Your next adventure').map((s,i)=>`<text x="65" y="${235+i*70}" font-family="Arial,sans-serif" font-size="57" font-weight="bold" fill="${paper}">${esc(s)}</text>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="${navy}"/>${image(t.hero,850,0,350,605,'xMidYMid slice')}<text x="65" y="90" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="${paper}">RON CLARK ACADEMY</text>${image(t.logo,680,40,130,95)}${title}<text x="65" y="485" font-family="Arial,sans-serif" font-size="34" font-weight="bold" fill="${gold}">${t.cohort?'CLASS OF '+esc(t.cohort):'CLASS YEAR TO COME'}</text><text x="65" y="545" font-family="Arial,sans-serif" font-size="26" fill="${paper}">One trip. Every moment.</text><rect y="605" width="1200" height="25" fill="${gold}"/></svg>`;
}
