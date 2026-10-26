import {createClient} from '@supabase/supabase-js';
let instance;
export function authClient() {
  if (!instance) {
    const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw Error('Administrator sign-in is not configured.');
    instance = createClient(url, key, {auth:{storageKey:'rcap-trip-studio-auth-v1', persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
  }
  return instance;
}
export async function callStudio(method = 'GET', body) {
  const {data, error} = await authClient().auth.getSession();
  if (error) throw error;
  if (!data.session) throw Error('Sign in to Trip Studio.');
  const r = await fetch('/api/trip-studio', {method, cache:'no-store', headers:{Authorization:`Bearer ${data.session.access_token}`, ...(body ? {'Content-Type':'application/json'} : {})}, ...(body ? {body:JSON.stringify(body)} : {})});
  const result = await r.json();
  if (!r.ok) throw Object.assign(Error(result.error || 'Could not reach Trip Studio.'), {status:r.status});
  return result;
}
