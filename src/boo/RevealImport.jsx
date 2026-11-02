import React, { useRef, useState } from 'react';
import { importPreparedReveal } from './reveal-import.js';
export default function RevealImport({ request, run, busy, onDone }) {
  const files = useRef([]), [count,setCount]=useState(0), [approved,setApproved]=useState(false), [progress,setProgress]=useState('');
  return <section><h4>Import a prepared private portrait folder</h4><p>This stores encrypted portraits for organizer review. It does not publish the reveal.</p><input aria-label="Prepared private portrait folder" type="file" webkitdirectory="" multiple disabled={busy} onChange={e=>{files.current=Array.from(e.target.files);setCount(files.current.length);setProgress('');}}/><label className="check-label"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>I am authorized to store these school portraits privately for review.</label><button disabled={busy||!approved||!count} onClick={()=>run(async()=>{await importPreparedReveal(files.current,request,setProgress);await onDone();files.current=[];setCount(0);setApproved(false);})}>Import privately</button><p role="status">{progress}</p></section>;
}
