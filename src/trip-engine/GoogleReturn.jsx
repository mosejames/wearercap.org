import {useEffect,useState} from 'react';
import {finishGoogleReturn} from './googleAuth.js';
export default function GoogleReturn(){const [status,setStatus]=useState('Finishing your Google sign-in…'),[done,setDone]=useState(false);
 useEffect(()=>{let active=true;finishGoogleReturn().then(()=>{if(!active)return;setStatus('You’re signed in. Return to your vault window to continue.');setDone(true);window.opener?.postMessage({type:'rca-vault-auth',ok:true},location.origin);}).catch(e=>{if(active){setStatus(e.message);window.opener?.postMessage({type:'rca-vault-auth',ok:false},location.origin);}});return()=>{active=false;};},[]);
 return <main className="engine-page engine-unavailable"><b>RON CLARK ACADEMY</b><h1>{done?'Ready to share.':'Connecting your account.'}</h1><p role="status">{status}</p><button onClick={()=>window.close()}>Return to the vault</button></main>;
}
