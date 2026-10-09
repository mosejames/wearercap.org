import { createClient } from '@supabase/supabase-js';
export const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY,{auth:{storageKey:'rcap-playbook-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
export async function call(action,payload={}) {const {data,error}=await supabase.rpc('rcap_playbook',{p_action:action,p_payload:payload});if(error)throw new Error(error.message);return data;}
export async function syncDrive(committee) {
 const {data:{session}}=await supabase.auth.getSession();
 if(!session)throw new Error('Sign in to save the record to Google Drive.');
 const r=await fetch('/api/feedback-draft',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({mode:'playbook_sync',committee})});
 const body=await r.json();if(!r.ok)throw new Error(body.error||'Google Drive could not be updated. Your contribution is saved in the playbook.');return body;
}
