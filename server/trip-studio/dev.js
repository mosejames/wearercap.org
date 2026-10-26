import {loadEnv} from 'vite';
export function tripStudioDev(){return {name:'trip-studio-private-api',configureServer(server){
 const env=loadEnv(server.config.mode,server.config.root,'');
 for(const[key,value]of Object.entries(env))if(/^(TRIP_STUDIO_|TRIP_ENGINE_|R2_|VITE_SUPABASE_|SUPABASE_URL$|SUPABASE_ANON_KEY$|NYC_EXPORT_KEY$)/.test(key)&&!process.env[key])process.env[key]=value;
 server.middlewares.use(async(req,res,next)=>{
  const u=new URL(req.url,'http://localhost'),path=u.pathname;let kind;
  req.query=Object.fromEntries(u.searchParams);
  if(path==='/api/trip-studio')kind='studio';else if(path==='/api/trip-engine')kind='engine';
  else{const m=path.match(/^\/trips\/([a-z0-9-]+)(?:\/(og\.jpg|send-off)|\/e\/(send-off|the-whole-adventure)\/p\/([a-f0-9-]{36}))?\/?$/);if(!m)return next();kind='card';req.query={...req.query,trip:m[1],...(m[2]==='og.jpg'?{og:'1'}:m[2]==='send-off'?{intake:'send-off'}:{}),...(m[3]?{album:m[3],photo:m[4]}:{})};}
  res.setHeader('Cache-Control','no-store');
  try{
   let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2500000){res.statusCode=413;res.end(JSON.stringify({error:'Choose smaller branding images.'}));return;}chunks.push(chunk);}
   req.body=Buffer.concat(chunks).toString()||undefined;
   res.status=code=>{res.statusCode=code;return res;};res.json=body=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));return res;};res.send=body=>{res.end(body);return res;};res.redirect=(code,url)=>{res.statusCode=code;res.setHeader('Location',url);res.end();return res;};
   const {default:handler}=kind==='studio'?await import('./index.js'):kind==='engine'?await import('../trip-engine/index.js'):await import('../trip-engine/card.js');await handler(req,res);
  }catch{res.statusCode=503;res.end(JSON.stringify({error:'Trip sharing is temporarily unavailable.'}));}
 });
}};}
