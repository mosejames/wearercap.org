import {emailContent} from './template.js';
const EXPECTED='845e8451538992670810c24f90ddfc6cfe1884590f734bef27a463c15760013d';
Deno.serve(async(req:Request)=>{
 const secret=req.headers.get('X-Trip-Export-Key')||'';
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret));
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(req.method!=='POST'||hash!==EXPECTED)return new Response('Unauthorized',{status:401});
 const key=Deno.env.get('RESEND_API_KEY');if(!key)return new Response('Email not configured',{status:503});
 try{
  const body=await req.json();if(body.health===true)return Response.json({configured:true});
  if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(body.email)||!/^https:\/\/wearercap\.org\/trip-vault\/\?trip=[a-z0-9-]+&archive=[a-f0-9]{64}$/.test(body.url)||!/^[a-f0-9]{64}$/.test(body.id)||!Number.isInteger(body.attempt)||body.attempt<1||!Number.isInteger(body.count)||body.count<1||typeof body.destination!=='string'||body.destination.length>80||!/^20[0-9]{2}$/.test(body.cohort))return new Response('Invalid request',{status:400});
  const {subject,text,html}=emailContent(body);
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`trip-export/${body.id}/${body.attempt}`},body:JSON.stringify({from:Deno.env.get('RESEND_FROM')||'RCAP <hello@wearercap.org>',to:[body.email],subject,text,html})});
  return new Response(r.ok?'Sent':'Email delivery unavailable',{status:r.ok?200:503});
 }catch{return new Response('Invalid request',{status:400});}
});
