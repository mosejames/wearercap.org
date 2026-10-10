import {useEffect,useState,useRef} from 'react';
import {client,syncAccount,signOutAccount} from './data.js';
export function normalizePhone(value){const raw=value.trim(),digits=raw.replace(/\D/g,'');if(/^\d{10}$/.test(digits)&&!raw.startsWith('+'))return `+1${digits}`;if(/^1\d{10}$/.test(digits))return `+${digits}`;if(raw.startsWith('+')&&/^[1-9]\d{7,14}$/.test(digits))return `+${digits}`;throw new Error('Enter a US number or include + and your country code.');}
export function LoginPanel({onReady,settings=false}) {
 const [method,setMethod]=useState('phone'),[contact,setContact]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[user,setUser]=useState(null),[backup,setBackup]=useState(false),[cooldown,setCooldown]=useState(0);
 useEffect(()=>{client.auth.getSession().then(({data})=>setUser(data.session?.user||null));},[]);
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(c=>c-1),1000);return()=>clearTimeout(timer);},[cooldown]);
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{
  const address=method==='phone'?normalizePhone(contact):contact.trim();
  let result;
  if(!sent){
   result=backup?await client.auth.updateUser({email:address}):await client.auth.signInWithOtp(method==='phone'?{phone:address,options:{channel:'sms'}}:{email:address,options:{shouldCreateUser:false,emailRedirectTo:new URL(window.location.pathname,window.location.origin).href}});
   if(result.error)throw result.error;setSent(true);setCooldown(60);
  }else{
   result=await client.auth.verifyOtp(method==='phone'?{phone:address,token:code.trim(),type:'sms'}:{email:address,token:code.trim(),type:backup?'email_change':'email'});
   if(result.error)throw result.error;
   await syncAccount();setUser(result.data.user);setSent(false);setCode('');setContact('');
   if(backup){setBackup(false);onReady();}else if(result.data.user?.email){onReady();}else{setBackup(true);setMethod('email');}
  }
 }catch(e){setError(e.message||'Sign-in could not finish. Please try again.');}finally{setBusy(false);}}
 function switchMethod(){setMethod(m=>m==='phone'?'email':'phone');setSent(false);setCode('');setContact('');setError('');}
 return <div className="l-login"><h3>{backup?'Add your backup email':user&&settings?'Your sharing account':'Keep your moments together'}</h3><p className="l-small">{backup?'Verify an email so you can sign in when texts aren’t available.':user&&settings?'Your uploads follow this account across devices.':'Sign in once with a text code. No password needed.'}</p>{user&&settings&&!backup?<><p>{user.phone?`Phone ending in ${user.phone.slice(-4)}`:'Email sign-in'}{user.email?' · Backup email connected':''}</p>{!user.email&&<button className="l-button" onClick={()=>{setBackup(true);setMethod('email');}}>Add backup email</button>}<button className="l-text" onClick={async()=>{await signOutAccount();window.location.reload();}}>Sign out</button></>:<><form onSubmit={submit}><fieldset disabled={busy}><label className="l-field">{sent?'Verification code':method==='phone'?'Mobile number':'Email address'}<input required type={sent?'text':method==='phone'?'tel':'email'} autoComplete={sent?'one-time-code':method==='phone'?'tel':'email'} inputMode={sent?'numeric':undefined} value={sent?code:contact} onChange={e=>sent?setCode(e.target.value):setContact(e.target.value)} placeholder={sent?'Enter your code':method==='phone'?'(404) 555-0123':'you@example.com'}/></label>{sent&&<p className="l-small">Check your {method==='phone'?'texts':'email'} for your code. </p>}<button className="l-button l-wide" disabled={busy}>{busy?'Please wait…':sent?'Verify code':method==='phone'?'Text me a code':'Email me a code'}</button>{sent&&<button type="button" className="l-text" disabled={cooldown>0} onClick={()=>{setSent(false);setCode('');}}>{cooldown?`Try again in ${cooldown}s`:'Resend or change address'}</button>}</fieldset></form>{!backup&&<button className="l-text" onClick={switchMethod}>{method==='phone'?'Use my backup email instead':'Use a text instead'}</button>}{backup&&<button className="l-text" onClick={onReady}>Skip for now</button>}</>}{error&&<p role="alert" className="l-error">{error}</p>}</div>;
}
export default function LoginGate({children,modal=false,close}) {
 const dialog=useRef(null);
 const [ready,setReady]=useState(false),[checking,setChecking]=useState(true),[error,setError]=useState('');
 useEffect(()=>{syncAccount().then(session=>setReady(Boolean(session))).catch(()=>setError('Couldn’t restore your account. Please sign in again.')).finally(()=>setChecking(false));},[]);
 useEffect(()=>{if(modal&&!checking&&!ready){dialog.current?.showModal();return()=>dialog.current?.close();}},[modal,checking,ready]);
 if(checking)return <p role="status">Checking your sharing account…</p>;
 if(ready)return children;
 const panel=<section className="l-login-gate"><LoginPanel onReady={()=>setReady(true)}/>{error&&<p role="alert">{error}</p>}</section>;
 return modal?<dialog ref={dialog} className="l-dialog" onCancel={close}><button className="l-close" aria-label="Close" onClick={close}>×</button>{panel}</dialog>:panel;
}
