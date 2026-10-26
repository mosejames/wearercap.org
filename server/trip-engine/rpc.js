export function problem(message,status=400){return Object.assign(Error(message),{status});}
export async function engineRpc(action,payload={},authorization){
 const base=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 if(!base||!key)throw problem('Trip sharing is not configured.',503);
 const r=await fetch(`${base}/rest/v1/rpc/trip_engine`,{method:'POST',headers:{apikey:key,Authorization:authorization||`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_payload:payload}),signal:AbortSignal.timeout(15000)});
 let result;try{result=await r.json();}catch{throw problem('The trip service could not respond. Please try again.',503);}
 if(!r.ok){const status=result.code==='P0002'?404:result.code==='42501'?403:['40001','23505'].includes(result.code)?409:r.status===401?401:400;const message=result.code==='23505'?'This link or photo is already registered.':result.message||'Could not complete this trip request.';throw problem(message,status);}
 return result;
}
export function bearer(req){const value=req.headers?.authorization;if(!value?.startsWith('Bearer ')||value.length>8192)throw problem('Please sign in to share.',401);return value;}
