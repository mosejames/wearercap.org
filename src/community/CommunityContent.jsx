import React,{createContext,useContext,useEffect,useState} from 'react';
import initial from './content.json';
import {validateContent} from './model.js';
const Context=createContext(initial);
export function CommunityProvider({children}) {
  const [content,setContent]=useState(initial);
  useEffect(()=>{
    let controller,disposed=false;
    async function refresh() {
      controller?.abort();
      const request=new AbortController();controller=request;
      const timeout=window.setTimeout(()=>request.abort(),8000);
      try {
        const response=await fetch('/community-content.json',{cache:'no-store',signal:request.signal});
        if(!response.ok) return;
        const next=validateContent(await response.json());
        if(!disposed && controller===request) setContent(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
      } catch { /* Keep the last good public content when offline or unavailable. */ }
      finally {window.clearTimeout(timeout);}
    }
    refresh();
    const interval=window.setInterval(refresh,60000);
    const visible=()=>{if(document.visibilityState==='visible') refresh();};
    window.addEventListener('focus',visible);window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);
    return()=>{disposed=true;controller?.abort();window.clearInterval(interval);window.removeEventListener('focus',visible);window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);};
  },[]);
  return <Context.Provider value={content}>{children}</Context.Provider>;
}
export const useCommunityContent=()=>useContext(Context);
