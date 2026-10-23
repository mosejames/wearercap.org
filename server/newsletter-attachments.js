import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {objectRequest,encrypt,decrypt} from './london-stories/storage.js';
export const MAX_ATTACHMENT_BYTES=3*1024*1024;
export const MAX_ATTACHMENTS=6;
const ROOT='_newsletter/intake-files/';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function signature(value){const key=process.env.LONDON_IMPORT_STATE_KEY;if(!key)throw Error('Attachment storage unavailable');return createHmac('sha256',key).update('newsletter-upload\n'+value).digest('hex');}
export function createUploadSession(now=Date.now()){
 const payload=Buffer.from(JSON.stringify({id:randomUUID(),expires:now+3600000})).toString('base64url');
 return {token:payload+'.'+signature(payload)};
}
export function readUploadSession(token,now=Date.now()){
 if(typeof token!=='string'||token.length>400)throw fail('Please submit the form again to restart the upload.');
 const [payload,sig,...extra]=token.split('.');
 if(extra.length||!/^[a-f0-9]{64}$/.test(sig||'')||!timingSafeEqual(Buffer.from(signature(payload),'hex'),Buffer.from(sig,'hex')))throw fail('The upload session is invalid.');
 let value;try{value=JSON.parse(Buffer.from(payload,'base64url').toString());}catch{throw fail('The upload session is invalid.');}
 if(!UUID.test(value.id||'')||!Number.isFinite(value.expires)||value.expires<now)throw fail('The upload session expired. Please submit the form again.');
 return value;
}
export function cleanAttachment(body){
 if(!Number.isInteger(body.index)||body.index<0||body.index>=MAX_ATTACHMENTS)throw fail('Choose up to six attachments.');
 if(typeof body.data!=='string'||body.data.length>Math.ceil(MAX_ATTACHMENT_BYTES/3)*4||!body.data.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.data))throw fail('Each attachment must be 3 MB or smaller.');
 const bytes=Buffer.from(body.data,'base64');if(bytes.toString('base64')!==body.data)throw fail('That attachment could not be read.');if(bytes.length>MAX_ATTACHMENT_BYTES)throw fail('Each attachment must be 3 MB or smaller.');
 let mime,ext;
 if(bytes.length>=4&&bytes.subarray(0,3).equals(Buffer.from([255,216,255]))){mime='image/jpeg';ext='jpg';}
 else if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){mime='image/png';ext='png';}
 else if(bytes.length>=16&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){mime='image/webp';ext='webp';}
 else if(bytes.toString('ascii',0,5)==='%PDF-'){mime='application/pdf';ext='pdf';}
 else throw fail('Use a JPG, PNG, WebP photo, or PDF flyer.');
 const stem=String(body.name||'attachment').replace(/\.[^.]*$/,'').replace(/[\x00-\x1f\x7f/\\<>:"|?*]/g,'').trim().slice(0,110)||'attachment';
 return {index:body.index,name:stem+'.'+ext,mime,size:bytes.length,data:body.data,storage:'r2'};
}
export async function uploadAttachment(body){
 const session=readUploadSession(body.token),file=cleanAttachment(body);
 // A finalized submission is immutable to its public upload capability.
 const submitted=await objectRequest('_newsletter/intake/'+session.id,{method:'HEAD'});
 if(submitted.ok)throw fail('This submission has already been received.',409);
 if(submitted.status!==404)throw Error('Could not check the submission');
 const r=await objectRequest(ROOT+session.id+'/'+file.index,{method:'PUT',headers:{'Content-Type':'application/octet-stream','If-None-Match':'*','Cache-Control':'no-store'},body:encrypt(file)});
 if(!r.ok)throw fail('That file could not be uploaded. Submit the form again to retry.',r.status===412?409:503);
 const {data,...metadata}=file;return metadata;
}
export async function submittedAttachments(body){
 if(!body.token){if(body.attachmentIndices?.length)throw fail('Please upload the attachments again.');return {id:randomUUID(),attachments:[]};}
 const session=readUploadSession(body.token),indices=body.attachmentIndices||[];
 if(indices.length&&body.permission!=='on')throw fail('Please confirm permission to share the attachments.');
 if(!Array.isArray(indices)||indices.length>MAX_ATTACHMENTS||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=MAX_ATTACHMENTS))throw fail('Please check the attachments.');
 const attachments=await Promise.all(indices.map(async index=>{
  const r=await objectRequest(ROOT+session.id+'/'+index);if(!r.ok)throw fail('An attachment did not finish uploading. Please try again.');
  const {data,...metadata}=decrypt(Buffer.from(await r.arrayBuffer()));return metadata;
 }));return {id:session.id,attachments};
}
// Only called after the invited-editor check, and only for files listed on that submission.
export async function getAttachment(body){
 if(!UUID.test(body.id||'')||!Number.isInteger(body.index))throw fail('Attachment not found.',404);
 const r=await objectRequest('_newsletter/intake/'+body.id);if(!r.ok)throw fail('Submission not found.',404);
 const item=decrypt(Buffer.from(await r.arrayBuffer()));if(!item.attachments?.some(f=>f.index===body.index))throw fail('Attachment not found.',404);
 const file=await objectRequest(ROOT+body.id+'/'+body.index);if(!file.ok)throw fail('Attachment unavailable.',404);
 return decrypt(Buffer.from(await file.arrayBuffer()));
}
