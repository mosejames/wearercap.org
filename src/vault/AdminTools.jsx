import { useCallback, useEffect, useState } from 'react';
import { rewardCall } from './rewards.js';

export function StaffPanel() {
  const [people,setPeople]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const refresh=useCallback(()=>rewardCall('vault_staff_list').then(setPeople).catch(e=>setError(e.message)),[]);
  useEffect(()=>{refresh();},[refresh]);
  const setRole=async(person,role)=>{
    if(!confirm(`${role ? `Give ${person.name} ${role} access?` : `Remove ${person.name}’s staff access?`}`))return;
    setBusy(true);setError('');
    try {await rewardCall('vault_staff_set',{p_user:person.id,p_role:role||null});await refresh();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <section className="adm-sec"><h2>Admin team</h2><p>You own the Vault. Admins manage events and moderation. Moderators review reports and remove inappropriate uploads. Only you can change these roles.</p><p className="fine">People appear here after verifying their phone and creating a profile. Each person uses their own sign-in.</p>{error&&<p className="err">{error}</p>}<div className="staff-list">{people.map(p=><div className="staff-row" key={p.id}><b>{p.name}</b>{p.role==='owner'?<span>Owner · You</span>:<select aria-label={`Access for ${p.name}`} value={p.role||''} disabled={busy} onChange={e=>setRole(p,e.target.value)}><option value="">Contributor</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select>}</div>)}</div></section>;
}
