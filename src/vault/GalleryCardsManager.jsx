import {useCallback, useEffect, useRef, useState} from 'react';
import {cardAsPromo, cardError, galleryCardsCall, newGalleryCard} from './galleryCards.js';
import './galleryCards.css';

export function GalleryCardsManager({events, pass, Preview, initialEvent = '', onChanged}) {
  const [cards,setCards]=useState(null),[form,setForm]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [query,setQuery]=useState(''),[galleryQuery,setGalleryQuery]=useState(''),[filter,setFilter]=useState('current');
  const titleInput=useRef(null), errorBox=useRef(null);
  const load=useCallback(async()=>{setError('');try{setCards(await galleryCardsCall('list',{},pass));}catch(e){setError(e.message);}},[pass]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{if(error)errorBox.current?.focus();},[error]);
  useEffect(()=>{if(form)titleInput.current?.focus();},[form?.id,!!form]);
  function edit(card) {setError('');setGalleryQuery('');setForm({...card,starts_on:card.starts_on||'',ends_on:card.ends_on||'',event_ids:[...card.event_ids]});}
  async function save(event) {
    event.preventDefault();if(busy)return;
    const problem=cardError(form);if(problem){setError(problem);return;}
    setBusy(true);setError('');
    try{const saved=await galleryCardsCall('save',form,pass);setCards(current=>[saved,...(current||[]).filter(c=>c.id!==saved.id)]);setForm(null);onChanged?.();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  function close(){if(busy)return;if(form && !window.confirm('Discard your unsaved card changes?'))return;setForm(null);setError('');}
  const set=(key,value)=>setForm(current=>({...current,[key]:value}));
  const selectedEvents=form ? events.filter(e=>form.event_ids.includes(e.id)) : [];
  return <section className="card-library" aria-label="Gallery card library">
    <div className="adm-head"><div><h2>Cards</h2><p>Create once, then show a card in one or more galleries. Changes appear without a website update.</p></div>
      {!form&&<button className="btn primary" onClick={()=>edit(newGalleryCard(initialEvent))}>Create a card</button>}</div>
    {error&&<p className="err" role="alert" tabIndex={-1} ref={errorBox}>{error}</p>}
    {form ? <form className="stack card-editor" onSubmit={save}>
      <div className="card-editor-fields">
        <h3>{form.id?'Edit card':'New card'}</h3>
        <label className="field"><span>Title</span><input ref={titleInput} required maxLength={120} value={form.title} onChange={e=>set('title',e.target.value)}/></label>
        <label className="field"><span>Small label (optional)</span><input maxLength={80} value={form.eyebrow} onChange={e=>set('eyebrow',e.target.value)} placeholder="For our RCA families"/></label>
        <label className="field"><span>Message (optional)</span><textarea rows={4} maxLength={600} value={form.body} onChange={e=>set('body',e.target.value)}/></label>
        <label className="field"><span>Button text</span><input required maxLength={60} value={form.cta} onChange={e=>set('cta',e.target.value)}/></label>
        <label className="field"><span>Destination link</span><input required maxLength={2000} value={form.href} onChange={e=>set('href',e.target.value)} placeholder="https://… or /georgia-goal/"/><small>Paste a full HTTPS link, a survey link, or a page path on this site.</small></label>
        <label className="field"><span>Image link (optional)</span><input maxLength={2000} value={form.image} onChange={e=>set('image',e.target.value)} placeholder="https://… or /images/…"/></label>
        <fieldset><legend>Status</legend><div className="card-status-choices">{[['draft','Draft'],['published','Published'],['archived','Archived']].map(([value,label])=><label key={value}><input type="radio" name="card-status" value={value} checked={form.status===value} onChange={()=>set('status',value)}/>{label}</label>)}</div><p className="fine">Drafts and archived cards stay private. Published cards appear in the galleries you choose during the dates below.</p></fieldset>
        <div className="card-date-fields"><label className="field"><span>Start date (optional)</span><input type="date" value={form.starts_on} onChange={e=>set('starts_on',e.target.value)}/></label><label className="field"><span>End date (optional)</span><input type="date" min={form.starts_on||undefined} value={form.ends_on} onChange={e=>set('ends_on',e.target.value)}/></label></div>
        <p className="fine">Dates use Eastern time. Leave dates blank to keep a published card available all year.</p>
        <label className="field"><span>Card order</span><input type="number" min={0} max={999} step={1} value={form.priority} onChange={e=>set('priority',e.target.value===''?'':Number(e.target.value))}/><small>Lower numbers appear first among your custom cards.</small></label>
        <fieldset className="card-gallery-picker"><legend>Choose galleries</legend>
          <label className="field"><span>Find a gallery</span><input type="search" value={galleryQuery} onChange={e=>setGalleryQuery(e.target.value)} placeholder="Search by name"/></label>
          <p className="fine">{form.event_ids.length} selected. Hidden galleries keep their cards hidden too.</p>
          <div className="card-gallery-options">{events.filter(e=>e.title.toLowerCase().includes(galleryQuery.toLowerCase())).map(e=><label key={e.id}><input type="checkbox" checked={form.event_ids.includes(e.id)} onChange={x=>set('event_ids',x.target.checked?[...form.event_ids,e.id]:form.event_ids.filter(id=>id!==e.id))}/><span>{e.title}{e.hidden?' (hidden)':''}</span></label>)}</div>
        </fieldset>
        <div className="row"><button className="btn primary" disabled={busy}>{busy?'Saving…':form.status==='published'?'Save and publish':'Save card'}</button><button type="button" className="btn ghost" disabled={busy} onClick={close}>Cancel</button></div>
      </div>
      <aside className="card-live-preview"><h3>Card preview</h3><p className="fine">This is how your card will look between the photos.</p><div className="card-preview-frame" inert><Preview promo={cardAsPromo({...form,id:form.id||'preview',title:form.title||'Your card title',cta:form.cta||'Learn more',href:form.href||'/'})}/></div><p className="fine">{form.status==='published'?'Published':'Private: '+form.status}{form.starts_on?' · Starts '+form.starts_on:''}{form.ends_on?' · Ends '+form.ends_on:''}</p><p className="fine">{selectedEvents.map(e=>e.title).join(' · ')||'No galleries selected yet.'}</p></aside>
    </form> : <>
      <div className="admin-tabs" aria-label="Card views">{[['current','Current cards'],['archived','Archived']].map(([key,label])=><button key={key} className={filter===key?'active':''} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>
      <label className="field"><span>Search cards</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a card"/></label>
      {cards===null ? <p role="status">{error?'Cards could not load.':'Loading your cards…'}</p>:<div className="card-library-list">{cards.filter(c=>(filter==='archived'?c.status==='archived':c.status!=='archived')&&(c.title+' '+c.body).toLowerCase().includes(query.toLowerCase())).map(card=><article key={card.id} className="card-library-row"><div><h3>{card.title}</h3><p className="fine">{card.status}{card.starts_on?' · From '+card.starts_on:''}{card.ends_on?' · Through '+card.ends_on:''} · {card.event_ids.length} galleries</p><p>{card.body}</p><a href={card.href} target="_blank" rel="noopener noreferrer">Open destination ↗</a></div><div className="row"><button className="btn small ghost" onClick={()=>edit(card)}>Edit</button><button className="btn small ghost" onClick={()=>edit({...card,id:undefined,revision:undefined,legacy_key:undefined,title:card.title.slice(0,113)+' (copy)',status:'draft'})}>Duplicate</button></div></article>)}{!cards.length&&<p>No custom cards yet. Create your first card above.</p>}</div>}
      {error&&<button className="btn ghost" onClick={load}>Try again</button>}
      <p className="fine">To remove a card from every gallery, edit it, choose Archived, and save. You can publish it again later. Existing standard cards remain available in each gallery’s settings.</p>
    </>}
  </section>;
}
