import {promoSlots} from './config.js';
import {uploadPromptSlots} from './galleryVoice.js';
export function cardHash(value) {
  let h=2166136261;
  for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
}
export function galleryCardLayout(promos,count,contributors,seed,showUploads=true,repeatPromos=true) {
  const shuffled=[...promos].sort((a,b)=>(a.priority||0)-(b.priority||0)||cardHash(`${seed}:${a.id}`)-cardHash(`${seed}:${b.id}`)||a.id.localeCompare(b.id));
  const seenCards=new Set();
  const promoEntries=promoSlots(shuffled,count).filter(s=>{if(repeatPromos)return true;if(seenCards.has(s.promo.id))return false;seenCards.add(s.promo.id);return true;});
  const entries=promoEntries.map(s=>({...s,type:'promo',target:s.at,key:`promo-${s.key}`}));
  if(showUploads)uploadPromptSlots(count,contributors).forEach((at,i)=>entries.push({type:'upload',target:at,index:i,key:`upload-${i}`}));
  entries.forEach(e=>{e.target=Math.max(Math.min(2,count),Math.min(count,e.target+(cardHash(`${seed}:${e.key}:position`)%11)-5));});
  entries.sort((a,b)=>a.target-b.target||a.key.localeCompare(b.key));
  const used=[];
  for(const entry of entries){
    let chosen;
    for(const gap of [3,1,0]){
      for(let distance=0;distance<=count;distance++){
        for(const position of [entry.target+distance,entry.target-distance]){
          if(position<Math.min(2,count)||position>count)continue;
          if(used.every(p=>Math.abs(p-position)>=gap)){chosen=position;break;}
        }
        if(chosen!==undefined)break;
      }
      if(chosen!==undefined)break;
    }
    entry.at=chosen??count;used.push(entry.at);
    entry.appearance=['navy','cream','gold','outline'][cardHash(`${seed}:${entry.key}:look`)%4];
  }
  const ordered=entries.sort((a,b)=>a.at-b.at||a.key.localeCompare(b.key));
  for(let i=1;i<ordered.length;i++)if(ordered[i].appearance===ordered[i-1].appearance){
    const looks=['navy','cream','gold','outline'];
    ordered[i].appearance=looks[(looks.indexOf(ordered[i].appearance)+1)%looks.length];
  }
  return ordered;
}
export function cardKind(card) {
  const text=`${card.href||''} ${card.title||''} ${card.eyebrow||''}`.toLowerCase();
  if(/feedback|survey|suggestion/.test(text))return 'voice';
  if(/goal|scholar|financial aid/.test(text))return 'school';
  if(/photo|booth|capsule/.test(text))return 'camera';
  if(/donat|membership|support/.test(text))return 'heart';
  if(/event|rsvp|night/.test(text))return 'event';
  return 'sparkles';
}
