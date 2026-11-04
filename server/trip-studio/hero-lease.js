import {randomUUID} from 'node:crypto';
import {problem} from './model.js';
async function lease(action,job,authorization){
 const base=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 if(!base||!key||!authorization?.startsWith('Bearer '))throw problem('Sign in again to create artwork.',401);
 let response;try{response=await fetch(`${base}/rest/v1/rpc/trip_studio_hero_lease`,{method:'POST',headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_job:job}),signal:AbortSignal.timeout(15000)});}catch{throw problem('Could not prepare image generation. Your photo is still selected. Please try again.',503);}
 if(!response.ok)throw problem(response.status===401?'Sign in again to create artwork.':'Image preparation is temporarily unavailable. Your photo is still selected. Please try again.',response.status===401?401:503);
 return response.json();
}
export async function claimHero(authorization){
 const job=randomUUID(),result=await lease('claim',job,authorization);
 if(result.busy)throw problem('An image is already being created. Wait for it to finish, then try again.',429);
 if(result.limitReached)throw problem('The daily limit of 10 image generations has been reached.',429);
 if(!result.claimed)throw problem('Could not prepare image generation. Your photo is still selected.',503);
 return ()=>lease('release',job,authorization);
}
