import {useState} from 'react';
import {authClient} from '../trip-studio/client.js';
export default function Auth({done,admin=false}){
 const [method,setMethod]=useState(admin?'email':'phone'),[contact,setContact]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{
  const value=method==='email'?contact.trim():contact.replace(/[^+\d]/g,'');const phone=value.startsWith('+')?value:`+1${value}`;
  const result=sent?await authClient().auth.verifyOtp(method==='email'?{email:value,token:code.trim(),type:'email'}:{phone,token:code.trim(),type:'sms'}):await authClient().auth.signInWithOtp(method==='email'?{email:value,options:{shouldCreateUser:false,emailRedirectTo:location.href}}:{phone,options:{channel:'sms'}});
  if(result.error)throw result.error;if(sent)done(result.data.session);else setSent(true);
 }catch(e){setError(e.message||'Please try again.');}finally{setBusy(false);}}
 return <section><h3>{admin?'Administrator sign-in':'Keep your moments together.'}</h3><p>Sign in once with a verification code. Your selected photos stay ready.</p><form onSubmit={submit}><label>{sent?'Verification code':method==='phone'?'Mobile number':'Email'}<input required type={sent?'text':method==='phone'?'tel':'email'} autoComplete={sent?'one-time-code':method==='phone'?'tel':'email'} value={sent?code:contact} onChange={e=>sent?setCode(e.target.value):setContact(e.target.value)}/></label><button className="engine-primary" disabled={busy}>{busy?'Please wait…':sent?'Verify code':method==='phone'?'Text me a code':'Email me a code'}</button></form><button className="engine-link" disabled={busy} onClick={()=>{setMethod(m=>m==='phone'?'email':'phone');setSent(false);setContact('');setCode('');setError('');}}>Use {method==='phone'?'email':'a text code'} instead</button>{sent&&<button className="engine-link" disabled={busy} onClick={()=>{setSent(false);setCode('');}}>Resend or change contact</button>}{error&&<p role="alert">{error}</p>}</section>;
}
