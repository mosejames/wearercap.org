import { useCallback, useEffect, useState } from 'react';
import { rewardCall } from './rewards.js';

export function StaffPanel({directory=false}) {
 const [people,setPeople]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [adding,setAdding]=useState(false),[query,setQuery]=useState(''),[filter,setFilter]=useState(''),[page,setPage]=useState(0),[editing,setEditing]=useState(null),[role,setRole]=useState('moderator');
 const refresh=useCallback(async()=>{try{setPeople(await rewardCall('vault_staff_list'));}catch(e){setError(e.message);}finally{setLoading(false);}},[]);
 useEffect(()=>{refresh();},[refresh]);
 const choose=p=>{setEditing(p);setRole(p.role||'moderator');setError('');};
 const save=async()=>{
  setBusy(true);setError('');
  try{await rewardCall('vault_staff_set',{p_user:editing.id,p_role:role||null});await refresh();setEditing(null);setAdding(false);setQuery('');}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const matches=people.filter(p=>(directory||adding||p.role)&&(!adding||!p.role)&&p.name.toLowerCase().includes(query.trim().toLowerCase())&&(!filter||(p.role||'contributor')===filter));
 const pages=Math.max(1,Math.ceil(matches.length/25)),current=Math.min(page,pages-1);
 return <section className="adm-sec">
  <div className="adm-head"><h2>{directory?'Members':'Admin team'}</h2>{!directory&&!adding&&<button className="btn small primary" onClick={()=>{setAdding(true);setQuery('');setPage(0);}}>Add team member</button>}</div>
  <p>{directory?'Find verified members and manage their access.':'Only staff appear here. You control who can manage galleries and help with moderation.'}</p>
  {adding&&<div className="row"><h3>Find a team member</h3><button className="link" onClick={()=>{setAdding(false);setQuery('');}}>Cancel</button></div>}
  {(directory||adding)&&<div className="member-search"><label className="field"><span>Search by name</span><input type="search" placeholder="Start typing a name" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>{directory&&<label className="field"><span>Role</span><select value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="">All roles</option><option value="contributor">Contributor</option><option value="moderator">Moderator</option><option value="admin">Admin</option><option value="owner">Owner</option></select></label>}</div>}
  {error&&<p className="err" role="alert">{error}</p>}
  {editing&&<div className="member-edit stack" role="region" aria-label={`Manage ${editing.name}`}><h3>Manage {editing.name}</h3><label className="field"><span>Access</span><select disabled={busy} value={role} onChange={e=>setRole(e.target.value)}>{editing.role&&<option value="">Contributor (remove staff access)</option>}<option value="moderator">Moderator</option><option value="admin">Admin</option></select></label><p>{role==='admin'?'Admins manage galleries, suggestions, and moderation.':role==='moderator'?'Moderators review reports, move uploads, and remove inappropriate content.':'They will keep their account and uploads, but lose staff access.'}</p><div className="row"><button className="btn small primary" disabled={busy} onClick={save}>{busy?'Saving…':'Confirm access change'}</button><button className="link" disabled={busy} onClick={()=>setEditing(null)}>Cancel</button></div></div>}
  {loading?<p>Loading members…</p>:adding&&!query.trim()?<p className="fine">Search for a verified member to add them to the team.</p>:<><div className="staff-list">{matches.slice(current*25,(current+1)*25).map(p=><div className="staff-row" key={p.id}><div><b>{p.name}</b><small className="member-role">{p.role||'Contributor'}</small></div>{p.role==='owner'?<span>You</span>:<button className="btn small ghost" disabled={busy} onClick={()=>choose(p)}>{adding?'Select':'Manage'}</button>}</div>)}</div>{!matches.length&&<p>No members match your search.</p>}{(directory||matches.length>25)&&<div className="member-pagination"><span>{matches.length} members · Page {current+1} of {pages}</span><button className="btn small ghost" disabled={!current} onClick={()=>setPage(current-1)}>Previous</button><button className="btn small ghost" disabled={current+1>=pages} onClick={()=>setPage(current+1)}>Next</button></div>}</>}
 </section>;
}
