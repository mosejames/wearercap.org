import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
export function SelectedPhoto({item,onRemove}){return <div className="up-tile"><img src={item.url} alt={item.sample?`Illustration: ${item.name}`:item.name} onError={e=>{e.currentTarget.style.display='none';}}/><span>{item.name}</span><button type="button" aria-label={`Remove ${item.name}`} onClick={()=>onRemove(item.id)}><X size={17}/></button></div>;}
export default function SelectionReview({items,onRemove,onClose}){
 const ref=useRef(null);
 useEffect(()=>{const previous=document.activeElement;ref.current?.showModal?.();return()=>{ref.current?.close?.();previous?.focus?.();};},[]);
 return <dialog ref={ref} className="up-review" aria-label="Review selected photos" onCancel={e=>{e.preventDefault();onClose();}}><div className="up-review-header"><div><h2>Review your photos</h2><p>{items.length} selected · Remove any you don’t want to share.</p></div><button type="button" aria-label="Close photo review" onClick={onClose}><X size={20}/></button></div><div className="up-review-scroll">{items.length?<div className="up-grid">{items.map(item=><SelectedPhoto key={item.id} item={item} onRemove={onRemove}/>)}</div>:<p>No photos selected. Add a few when you’re ready.</p>}</div><div className="up-review-footer"><button type="button" className="up-primary" onClick={onClose}>Done reviewing · {items.length} selected</button><p>Nothing is shared until you continue and tap Share.</p></div></dialog>;
}
