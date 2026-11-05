import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateContent,publicContent} from '../src/community/model.js';
export function communityContent({sourceFile}={}) {
  const source=sourceFile || fileURLToPath(new URL('../src/community/content.json',import.meta.url));
  const sanitize=text=>JSON.stringify(publicContent(validateContent(JSON.parse(text))));
  const read=()=>sanitize(readFileSync(source,'utf8'));
  return {name:'shared-community-content',enforce:'pre',transform(code,id){if(id.split('?')[0]===source) return {code:sanitize(code),map:null};},configureServer(server){
    server.middlewares.use((req,res,next)=>{
      if(req.url?.split('?')[0]!=='/community-content.json') return next();
      try{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(read());}catch(error){res.statusCode=500;res.end(JSON.stringify({error:'Community content unavailable'}));}
    });
  },generateBundle(){this.emitFile({type:'asset',fileName:'community-content.json',source:read()});}};
}
