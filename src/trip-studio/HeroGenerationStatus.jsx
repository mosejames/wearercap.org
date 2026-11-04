import {useEffect,useState} from 'react';
export function elapsedLabel(seconds){return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
export default function HeroGenerationStatus({startedAt}){
 const [elapsed,setElapsed]=useState(()=>Math.max(0,Math.floor((Date.now()-startedAt)/1000)));
 useEffect(()=>{const update=()=>setElapsed(Math.max(0,Math.floor((Date.now()-startedAt)/1000)));update();const timer=setInterval(update,1000);return()=>clearInterval(timer);},[startedAt]);
 const message=elapsed>=180?'This is taking longer than usual. We’re still waiting for the image service to respond.':elapsed>=60?'Still waiting for your artwork. Image creation can take a few minutes.':'Your image request is in progress. This can take a few minutes.';
 return <div className="hero-generation-status"><div className="hero-generation-heading"><span className="hero-generation-spinner" aria-hidden="true"/><div><b>Creating your hero image</b><span className="hero-generation-clock" role="timer" aria-live="off" aria-label="Elapsed generation time">{elapsedLabel(elapsed)} <small>elapsed</small></span></div></div><p role="status">{message}</p><small>Keep this page open. This timer shows elapsed time, not how much is complete. Your current hero stays unchanged until you choose a result.</small></div>;
}
