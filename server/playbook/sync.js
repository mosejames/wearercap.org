export default async function playbookSync(req,res) {
 res.setHeader('Cache-Control','no-store');
 const token=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
 const committee=req.body?.committee;
 if(!token||!['marcom','men','trunk'].includes(committee))return res.status(400).json({error:'Sign in and choose your committee before saving to Drive.'});
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 try{
  const access=await fetch(`${url}/rest/v1/rpc/rcap_playbook`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({p_action:'load',p_payload:{committee}}),signal:AbortSignal.timeout(10000)});
  if(!access.ok)return res.status(403).json({error:'Committee member access is required to save this record.'});
  const webhook=process.env.PLAYBOOK_DRIVE_WEBHOOK_URL;
  if(!webhook)return res.status(503).json({error:'Your contribution is saved. The Google Drive connection is awaiting its one-time authorization.'});
  const endpoint=new URL(webhook);
  if(endpoint.origin!=='https://script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(endpoint.pathname))throw new Error('Invalid Drive configuration');
  // Google rechecks membership and pulls the record itself. Client-supplied text
  // or arbitrary document IDs never enter the owner-authorized Drive updater.
  const response=await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({committee,token,key}),redirect:'follow',signal:AbortSignal.timeout(45000)});
  const result=await response.json();
  if(!response.ok||!result.ok)throw new Error('Drive update failed');
  return res.status(200).json({ok:true,doc_url:result.doc_url,synced_at:result.synced_at});
 }catch{return res.status(502).json({error:'Your contribution is saved. Google Drive could not be updated just now. Use Save record to Drive to retry.'});}
}
