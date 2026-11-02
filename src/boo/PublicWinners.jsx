import React,{useEffect,useState}from 'react';
import {ordinal}from './reveal-model.js';
export default function PublicWinners(){
 const[winners,setWinners]=useState([]);
 useEffect(()=>{let active=true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);fetch('/api/little-boo?action=winners',{signal:controller.signal,credentials:'omit'}).then(async r=>{if(!r.ok)return;const data=await r.json();if(active&&Array.isArray(data.winners)&&data.winners.length===3)setWinners(data.winners);}).catch(()=>{}).finally(()=>clearTimeout(timeout));return()=>{active=false;controller.abort();clearTimeout(timeout);};},[]);
 if(!winners.length)return null;
 return <section className="public-winners" aria-label="Little Boo winners"><span className="eyebrow">CONGRATULATIONS</span><h1>Our Little Boo winners</h1><ol>{winners.map(w=><li key={w.place}><span>{ordinal(w.place)}</span><strong>{w.name}</strong><b>{w.points}<small> POINTS</small></b></li>)}</ol><p>Sign in with your passcode to see the photos and your own results.</p></section>;
}
