import {authClient} from '../trip-studio/client.js';
export const GOOGLE_RETURN='/trip-vault/?auth_callback=1';
export const hasGoogle=user=>user?.identities?.some(i=>i.provider==='google')||false;
export function authMessage(error){
 const value=String(error?.message||error||'');
 if(/already.*(linked|registered|exists)|identity_already_exists/i.test(value))return 'That Google account is already connected to another account. Your original uploads remain with your phone account. Use your phone code to keep access; ask the organizer for help connecting the accounts.';
 if(/manual.*link|linking.*disabled/i.test(value))return 'Google account linking is temporarily unavailable. Keep using your phone code; your previous uploads are safe.';
 return 'Google sign-in could not finish. Try again or use a phone code. Your selected photos stay ready.';
}
// Open synchronously from a tap so phones can allow the window. Never redirect
// the upload page: its selected File objects must stay in memory.
export function googleWindow({link=false,client=authClient(),open=()=>window.open('about:blank','rca-vault-google','popup,width=500,height=720'),timeoutMs=180000}={}){
 const popup=open();if(!popup)return Promise.reject(Error('Allow the Google sign-in window, or use a phone code. Your selected photos stay ready.'));
 return new Promise((resolve,reject)=>{let settled=false,checking=false,expectedId;
  const cleanup=()=>{clearInterval(poll);clearTimeout(deadline);window.removeEventListener('message',message);};
  const finish=(error,session)=>{if(settled)return;settled=true;cleanup();try{popup.close();}catch{}error?reject(error):resolve(session);};
  async function complete(){if(checking||settled)return;checking=true;try{const {data,error}=await client.auth.getUser();if(error)throw error;const user=data.user;if(!hasGoogle(user))throw Error('Google sign-in did not complete.');if(expectedId&&user.id!==expectedId)throw Error('The linked account could not be verified. Use your original phone sign-in.');const current=await client.auth.getSession();if(current.error||!current.data.session)throw current.error||Error('Sign in again.');finish(null,{...current.data.session,user});}catch(e){finish(e);}finally{checking=false;}}
  function message(event){if(event.origin!==location.origin||event.source!==popup||event.data?.type!=='rca-vault-auth')return;if(event.data.ok)complete();else finish(Error('Google sign-in was cancelled or could not finish. Your selected photos stay ready.'));}
  window.addEventListener('message',message);
  const poll=setInterval(()=>{if(popup.closed)finish(Error('Google sign-in was closed. Try again or use a phone code. Your selected photos stay ready.'));},500);
  const deadline=setTimeout(()=>finish(Error('Google sign-in timed out. Try again or use a phone code. Your selected photos stay ready.')),timeoutMs);
  (async()=>{try{if(link){const current=await client.auth.getSession();if(current.error||!current.data.session)throw Error('Sign in with your original phone first.');expectedId=current.data.session.user.id;}
   const options={redirectTo:location.origin+GOOGLE_RETURN,skipBrowserRedirect:true,scopes:'openid email profile',queryParams:{hd:'ronclarkacademy.com',prompt:'select_account'}};
   const result=await client.auth[link?'linkIdentity':'signInWithOAuth']({provider:'google',options});if(result.error)throw Error(authMessage(result.error));if(!result.data?.url)throw Error('Google sign-in is unavailable. Use a phone code.');if(settled)return;popup.location.href=result.data.url;
  }catch(e){finish(e);}})();
 });
}
export async function finishGoogleReturn(client=authClient()){
 // Initialization exchanges the PKCE code and saves the existing storage key.
 const initialized=await client.auth.initialize();
 const params=new URLSearchParams(location.hash.slice(1));
 const failed=initialized.error||params.get('error')||new URLSearchParams(location.search).get('error');
 history.replaceState(null,'',GOOGLE_RETURN);
 if(failed)throw Error('Google sign-in could not finish. Return to the vault and try a phone code.');
 const {data,error}=await client.auth.getUser();if(error||!hasGoogle(data.user))throw Error('Google sign-in could not be confirmed. Return to the vault and try again.');
 return data.user;
}
