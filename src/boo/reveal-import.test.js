// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {importPreparedReveal} from './reveal-import.js';
it('prevalidates missing files, imports sequentially and never publishes',async()=>{
const id='a5000000-0000-4000-8000-000000000001', manifest={publication_status:'held_private',assets:[{id,local_file:'/private/'+id+'.jpg'}],entries:[{confirmed:true,portrait_ids:[id]}]};
const file={name:'prepared-reveal.json',text:async()=>JSON.stringify(manifest)},request=vi.fn(async()=>({}));
await expect(importPreparedReveal([file],request)).rejects.toThrow('JPEG');expect(request).not.toHaveBeenCalled();
const jpeg=new File(['fictional bytes'],id+'.jpg',{type:'image/jpeg'});
await importPreparedReveal([file,jpeg],request);
expect(request.mock.calls.map(x=>x[0])).toEqual(['reveal-admin','reveal-upload','reveal-register-entries']);
});
