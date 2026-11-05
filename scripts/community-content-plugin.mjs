import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateContent} from '../src/community/model.js';
const source=fileURLToPath(new URL('../src/community/content.json',import.meta.url));
export function communityContent() {
  const read=()=>JSON.stringify(validateContent(JSON.parse(readFileSync(source,'utf8'))));
  return {name:'shared-community-content',configureServer(server){
    server.middlewares.use((req,res,next)=>{
      if(req.url?.split('?')[0]!=='/community-content.json') return next();
      try{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(read());}catch(error){res.statusCode=500;res.end(JSON.stringify({error:'Community content unavailable'}));}
    });
  },generateBundle(){this.emitFile({type:'asset',fileName:'community-content.json',source:read()});}};
}
