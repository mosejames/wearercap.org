export async function duplicateDetails(prepared){
 const digest=await crypto.subtle.digest('SHA-256',await prepared.orig.arrayBuffer());
 const sourceHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 let duplicateThumb;
 if(!prepared.video){const bytes=new Uint8Array(await prepared.thumb.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));duplicateThumb=btoa(text);}
 return {sourceHash,duplicateThumb};
}
