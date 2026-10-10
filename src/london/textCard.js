// Written moments use the existing R2 media pipeline, so their cards can be
// shared, thanked and removed exactly like a photo, without a second store.
export const THOUGHT_STARTERS = ['I can’t wait to…', 'Today surprised me because…', 'A moment I want to remember…'];
export function momentText({ mode, text, speaker = '', starter = '' }) {
 const body = text.trim();
 if (!body || body.length > 220 || speaker.trim().length > 40) throw new Error('Add your words, up to 220 characters.');
 return `${mode === 'thought' ? `${starter} ` : ''}${body}${mode === 'quote' && speaker.trim() ? ` (${speaker.trim()})` : ''}`;
}
export function wrapCardText(ctx, text, maxWidth) {
 const lines = []; let line = '';
 for (const word of text.trim().split(/\s+/)) {
  const candidate = line ? `${line} ${word}` : word;
  if (ctx.measureText(candidate).width <= maxWidth) { line = candidate; continue; }
  if (line) { lines.push(line); line = ''; }
  // Break only unusually long tokens, never ordinary words.
  for (const char of word) {
   if (line && ctx.measureText(line + char).width > maxWidth) {lines.push(line);line='';}
   line += char;
  }
 }
 if (line) lines.push(line);
 return lines;
}

export async function makeTextCard({ mode, text, speaker, starter, prompt = '' }) {
 const caption = momentText({mode,text,speaker,starter});
 await document.fonts?.ready;
 const canvas = document.createElement('canvas'); canvas.width = 1200;canvas.height = 1200;
 const ctx = canvas.getContext('2d');
 if (!ctx) throw new Error('Your browser could not prepare the written moment. Please try again.');
 const dark = mode === 'quote';
 ctx.fillStyle = dark ? '#1a2a56' : '#faf8f2';ctx.fillRect(0,0,1200,1200);
 ctx.fillStyle = '#f0b323';ctx.fillRect(70,70,70,7);
 ctx.font = '700 22px "DM Sans", sans-serif';ctx.fillStyle = dark ? '#f2ce78' : '#946809';
 ctx.fillText('RCA 2028 · LONDON + PARIS',70,125);
 if (prompt) {ctx.font='24px "DM Sans", sans-serif';ctx.fillStyle=dark?'#bdc9df':'#657085';wrapCardText(ctx,prompt,1060).slice(0,3).forEach((line,i)=>ctx.fillText(line,70,190+i*34));}
 const body = mode === 'quote' ? `“${text.trim()}”` : mode === 'thought' ? `${starter} ${text.trim()}` : text.trim();
 let size = 64, lines;
 do {ctx.font=`600 ${size}px "DM Sans", sans-serif`;lines=wrapCardText(ctx,body,1060);if(lines.length*size*1.3<=650)break;size-=2;} while(size>24);
 ctx.fillStyle=dark?'#fffdf6':'#1a2a56';lines.forEach((line,i)=>ctx.fillText(line,70,330+i*size*1.3));
 ctx.font='26px "DM Sans", sans-serif';ctx.fillStyle=dark?'#f2ce78':'#657085';
 ctx.fillText(mode==='quote'&&speaker?.trim()?speaker.trim():mode==='thought'?'A little moment, in words.':'A thought shared.',70,1090);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
 if(!blob)throw new Error('Could not prepare your written moment. Please try again.');
 return {file:new File([blob],`${mode}-moment.jpg`,{type:'image/jpeg'}),caption};
}
