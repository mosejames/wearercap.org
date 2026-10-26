import {loadEnv} from 'vite';
export function tripStudioDev() {
  return {name:'trip-studio-private-api', configureServer(server) {
    const env = loadEnv(server.config.mode, server.config.root, '');
    for (const [key,value] of Object.entries(env)) if (/^(TRIP_STUDIO_|R2_|VITE_SUPABASE_|SUPABASE_URL$|SUPABASE_ANON_KEY$|NYC_EXPORT_KEY$)/.test(key) && !process.env[key]) process.env[key]=value;
    server.middlewares.use(async (req,res,next)=>{
      if (new URL(req.url,'http://localhost').pathname !== '/api/trip-studio') return next();
      res.setHeader('Cache-Control','private, no-store');
      try {
        let size=0;const chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>2500000){res.statusCode=413;res.end(JSON.stringify({error:'Choose smaller branding images.'}));return;}chunks.push(chunk);}
        req.body=Buffer.concat(chunks).toString() || undefined;
        res.status=code=>{res.statusCode=code;return res;};
        res.json=body=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));return res;};
        const {default:handler}=await import('./index.js');
        await handler(req,res);
      }catch{res.statusCode=503;res.end(JSON.stringify({error:'Trip Studio is temporarily unavailable.'}));}
    });
  }};
}
