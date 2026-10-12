// Local-only preview. Never writes to R2 or the live database.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {createClient} from '@supabase/supabase-js';
import {createServer,loadEnv} from 'vite';
const root=process.cwd(), out=path.join(root,'.deploy/stories-preview');
await fs.mkdir(out,{recursive:true});
const env=loadEnv('production',root,'');
const client=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:events,error:e}=await client.from('m3_events').select('id,slug,title').eq('vault','london-2028').eq('hidden',false);if(e)throw e;
const {data:existing,error:p}=await client.rpc('m3_list_photos',{p_token:'0'.repeat(48),p_vault:'london-2028',p_mode:'recent',p_limit:5000});if(p)throw p;
const storage=await(await fetch('https://wearercap.org/api/london-sign')).json();if(!storage.publicBase)throw Error('Missing R2 base');
const photos=existing.map(({photo:r})=>({id:r.id,eventId:r.event_id,owner:r.owner,uploaderName:r.uploader_name,scholarName:r.scholar_name||'',team:r.team||'',storage:r.storage,key:r.key,webKey:r.web_key,thumbKey:r.thumb_key,caption:r.caption||'',kind:r.kind,createdAt:r.created_at,takenAt:r.taken_at}));
const registeredSources=JSON.parse(await fs.readFile('src/london/storySources.json','utf8'));
const importedMediaIds=new Set(Object.values(registeredSources).flatMap(s=>(s.credits||[]).map(c=>c.identity).filter(Boolean)));
const ledger=[];const seen=new Set();
for(const account of await fs.readdir('.deploy/stories-source')){
 if(!/^[a-zA-Z0-9_.]+$/.test(account))continue;
 const folder=path.join('.deploy/stories-source',account);
 for(const name of await fs.readdir(folder)){
  if(!name.endsWith('.json'))continue;
  const meta=JSON.parse(await fs.readFile(path.join(folder,name),'utf8'));
  if(meta.account!==account||!meta.media_pk||!Number.isFinite(Date.parse(meta.taken_at)))throw Error('Invalid sidecar');
  if(seen.has(String(meta.media_pk)))continue;seen.add(String(meta.media_pk));
  const file=path.join(folder,name.slice(0,-5));const bytes=await fs.readFile(file);const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  const id=crypto.createHash('sha256').update('london-instagram:'+meta.media_pk).digest('hex').slice(0,32);
  const video=file.endsWith('.mp4');const orig=id+(video?'.mp4':'.jpg'),web=id+'.web.jpg',thumb=id+'.thumb.jpg';
  await fs.writeFile(path.join(out,orig),bytes);
  let input=bytes;
  if(video){execFileSync('ffmpeg',['-y','-v','error','-i',path.join(out,orig),'-frames:v','1',path.join(out,web)]);input=await fs.readFile(path.join(out,web));}
  await sharp(input).rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toFile(path.join(out,web)+'.tmp');await fs.rename(path.join(out,web)+'.tmp',path.join(out,web));
  await sharp(input).rotate().resize({width:560,height:560,fit:'inside',withoutEnlargement:true}).jpeg({quality:80}).toFile(path.join(out,thumb));
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date(meta.taken_at));const slug=day==='2026-10-11'?'off-we-go':'hello-london';
  const event=events.find(e=>e.slug===slug)||events[0];
  const row={id,eventId:event.id,owner:'instagram-preview',uploaderName:'Shared on Instagram by @'+account,scholarName:'',caption:'',kind:video?'video':'photo',createdAt:meta.taken_at,takenAt:meta.taken_at,previewMedia:true,key:orig,webKey:web,thumbKey:thumb,instagram:{account,mediaId:String(meta.media_pk),permalink:meta.permalink,credit:'Shared on Instagram by @'+account}};
  // Exact source hashes prevent duplicate media in this staged batch.
  const duplicate=ledger.find(r=>r.sha256===hash);const liveId=`${id.slice(0,8)}-${id.slice(8,12)}-5${id.slice(13,16)}-a${id.slice(17,20)}-${id.slice(20,32)}`;if(!duplicate&&!importedMediaIds.has(String(meta.media_pk))&&!photos.some(p=>p.id===liveId))photos.push(row);
  ledger.push({mediaId:String(meta.media_pk),account,sha256:hash,original:orig,duplicateOf:duplicate?.mediaId||null,takenAt:meta.taken_at});
 }
}
await fs.writeFile(path.join(out,'ledger.json'),JSON.stringify(ledger,null,2));
await fs.writeFile(path.join(out,'snapshot.json'),JSON.stringify({events,photos,publicBase:storage.publicBase}));
const mock=path.join(out,'data.js');
await fs.writeFile(mock,`const s=await fetch('/__stories/snapshot.json').then(r=>r.json()); export const localProfile=()=>null,localScholar=()=>'',getOwner=async()=>null,listEvents=async()=>s.events,listPhotos=async()=>s.photos,syncAccount=async()=>null; export const mediaUrl=(p,w='web')=>(p.previewMedia?'/__stories/':s.publicBase+'/')+((w==='orig'||w==='playback')?p.key:w==='thumb'?p.thumbKey:p.webKey); const blocked=async()=>{throw Error('This private preview is read-only.');};export const saveProfile=blocked,saveScholar=blocked,setThanks=blocked,hidePhoto=blocked,categorizePhoto=blocked,checkPass=blocked;export const conversation=async(id,action)=>{if(action&&action!=='read')return blocked();return {reactions:[],comments:[]};};`);
if(process.argv.includes('--stage-only')) { console.log(JSON.stringify({staged:ledger.length,newPreviewItems:photos.filter(p=>p.previewMedia).length})); process.exit(0); }
const server=await createServer({plugins:[{name:'private-stories-preview',enforce:'pre',transform(code,id){if(id.endsWith('/src/london/App.jsx'))return code.replace("'./data.js'",JSON.stringify(mock)).replace('async function sharePhoto(photo) {','async function sharePhoto(photo) { return setNotice("Sharing is turned off in this private preview.");').replace('<main>','<main><p style={{padding:"14px",background:"#1c2d56",color:"white",borderRadius:12}}>Private preview · Instagram moments mixed into the gallery. Live vault unchanged.</p>').replace("<span>With thanks to {p.uploaderName || 'a trip friend'}{p.team ? ` · ${p.team}` : ''}</span>",'<InstagramCredit photo={p}/>').replace("<p>With thanks to <b>{photo.uploaderName || 'a trip friend'}</b>{photo.team ? ` · ${photo.team}` : ''}</p>",'<InstagramCredit photo={photo}/>').concat(`\nfunction InstagramCredit({photo}) {return photo.instagram?<a href={'https://www.instagram.com/'+photo.instagram.account+'/'} target="_blank" rel="noreferrer" title={photo.instagram.credit} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,border:'1px solid #ddd7cb',borderRadius:20,padding:'5px 10px',color:'#674270',background:'#f5edf3',textDecoration:'none',margin:'8px 0'}}><span aria-hidden="true">◎</span> Instagram · @{photo.instagram.account}</a>:<span>With thanks to {photo.uploaderName||'a trip friend'}</span>;}`);if(id.endsWith('/src/london/LoginGate.jsx'))return `import React from 'react';export function LoginPanel(){return <p>This private preview is read-only. Uploading and signing in are available in the live vault.</p>;}export default LoginPanel;`;},configureServer(server){server.middlewares.use('/__stories',async(req,res,next)=>{const name=decodeURIComponent((req.url||'').split('?')[0]).slice(1);if(!/^[a-zA-Z0-9.-]+$/.test(name)){res.statusCode=404;return res.end();}try{const bytes=await fs.readFile(path.join(out,name));res.setHeader('Content-Type',name.endsWith('.json')?'application/json':name.endsWith('.mp4')?'video/mp4':'image/jpeg');res.setHeader('Cache-Control','no-store');res.end(bytes);}catch{res.statusCode=404;res.end();}});}}],server:{host:'127.0.0.1',port:5196,strictPort:true}});
await server.listen();console.log(JSON.stringify({preview:'http://127.0.0.1:5196/2028-london/#memories',staged:ledger.length,photos:ledger.filter(x=>x.original.endsWith('.jpg')).length,videos:ledger.filter(x=>x.original.endsWith('.mp4')).length}));
