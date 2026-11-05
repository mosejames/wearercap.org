import React, {useState, useEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowLeft, ArrowRight, ArrowUpRight, Search, X, Home, Newspaper, Camera, Grid2X2, CalendarDays, Shirt, Car, HandHeart, Clock, Users, HeartHandshake, Lightbulb, BookOpen, Compass, Send, Ticket, Images, Mail, Instagram, ClipboardList, Smartphone, PlusSquare, Globe} from 'lucide-react';
import {CommunityProvider,useCommunityContent} from '../community/CommunityContent.jsx';
import {publicTools} from '../community/model.js';
import {INSTALL_NUDGE_KEY,readInstallPreference,saveInstallPreference} from './installPreference.js';
import NextUp from './NextUp.jsx';
import Announcements,{useAnnouncements} from '../community/Announcements.jsx';
import {fetchCapsuleAlbums} from './albums.js';
import Calendar from './Calendar.jsx';
import InstallGuide from './InstallGuide.jsx';
import './styles.css';

const icons = {Newspaper,CalendarDays,Camera,Shirt,Car,HandHeart,Clock,Users,HeartHandshake,Lightbulb,BookOpen,Compass,Send,Ticket,Images,Mail,Instagram,ClipboardList};
const tileOrder = [
  {id:'calendar',title:'Calendar',page:'calendar'},
  {id:'capsule',title:'RCAP Capsule',page:'photos'},
  {id:'newsletter',title:'Newsletter',page:'updates'},
  {id:'volunteer',title:'Serve at EXP'},
  {title:'Resources',icon:'BookOpen',page:'resources',color:'blue'},
  {id:'uniforms',title:'Uniforms'},
  {id:'hours',title:'Volunteer hours'},
  {id:'collective',title:'Our community'},
  {title:'Contact',icon:'Mail',page:'contact',color:'blue'},
];
const nav = [['home','Home',Home],['updates','Updates',Newspaper],['photos','Photos',Camera],['more','More',Grid2X2]];
function currentPage() {
  const value = location.hash.slice(1);
  return ['home','more','search','calendar','everyday','resources','updates','photos','involved','contact'].includes(value) ? value : 'home';
}
function Icon({name,...props}) {
  const Component = icons[name] || Grid2X2;
  return <Component aria-hidden="true" strokeWidth={1.7} {...props}/>;
}
function ToolRow({link}) {
  return <div className="tool-row"><a href={link.href}>
    <span className={'icon-box '+link.color}><Icon name={link.icon} size={24}/></span>
    <span className="row-copy"><strong>{link.title}</strong><small>{link.detail}</small></span>
    <ArrowUpRight className="row-arrow" size={19} aria-hidden="true"/>
  </a></div>;
}
function ToolList({items}) {
  return <div className="tool-list">{items.map(link=><ToolRow key={link.id} link={link}/>)}</div>;
}
function NewsletterCard() {
  return <a className="newsletter-banner" href="/newsletter">
    <span className="banner-icon"><Newspaper size={28} aria-hidden="true"/></span>
    <span><small>FROM OUR COMMUNITY</small><strong>A little news. A lot of RCAP.</strong><span>Read the latest newsletter and past issues.</span></span>
    <ArrowUpRight size={23} aria-hidden="true"/>
  </a>;
}
function useCapsuleAlbums(enabled, online) {
  const [state,setState] = useState({albums:[],status:'loading'});
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    if(!enabled) return;
    if(!online) {setState({albums:[],status:'error'});return;}
    let controller, disposed = false;
    async function refresh() {
      controller?.abort();
      controller = new AbortController();
      const request = controller;
      const timeout = window.setTimeout(()=>request.abort(),8000);
      try {
        const albums = await fetchCapsuleAlbums(request.signal);
        if(!disposed && controller===request) setState({albums,status:'ready'});
      } catch {
        if(!disposed && controller===request) setState({albums:[],status:'error'});
      } finally {window.clearTimeout(timeout);}
    }
    setState({albums:[],status:'loading'});
    refresh();
    const interval = window.setInterval(refresh,60000);
    const visible = () => {if(document.visibilityState==='visible') refresh();};
    document.addEventListener('visibilitychange',visible);
    window.addEventListener('focus',visible);
    return () => {disposed=true;controller?.abort();window.clearInterval(interval);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);};
  },[enabled,online,attempt]);
  return {...state,retry:()=>setAttempt(n=>n+1)};
}
function App() {
  const community=useCommunityContent();
  const announcements=useAnnouncements();
  const links=publicTools(community), groups=community.groups;
  const tiles=tileOrder.map(tile=>({...links.find(link=>link.id===tile.id),...tile,...(tile.page?{href:undefined}:{})}));
  const [installHidden,setInstallHidden]=useState(()=>{try{return readInstallPreference(window.localStorage);}catch{return false;}});
  function hideInstall(reason='dismissed') {setInstallHidden(true);try{saveInstallPreference(window.localStorage,reason);}catch{}}
  function openInstall() {hideInstall('seen');dialog.current.showModal();}

  const [page,setPage] = useState(currentPage);
  const [query,setQuery] = useState('');
  const [online,setOnline] = useState(navigator.onLine);
  const [install,setInstall] = useState(null);
  const [installed,setInstalled] = useState(()=>window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
  const dialog = useRef(null), title = useRef(null), searchInput = useRef(null), first = useRef(true);
  const {albums,status:albumStatus,retry} = useCapsuleAlbums(['photos','search','more'].includes(page),online);
  useEffect(() => {
    const route = () => {setPage(currentPage());setQuery('');};
    const on = () => setOnline(true), off = () => setOnline(false);
    const prompt = e => {e.preventDefault();setInstall(e);};
    const saved = () => {setInstalled(true);hideInstall('installed');};
    const storage = e => {if(e.key===INSTALL_NUDGE_KEY) {try{setInstallHidden(readInstallPreference(window.localStorage));}catch{}}};
    window.addEventListener('storage',storage);
    if(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true) hideInstall('installed');
    window.addEventListener('hashchange',route);
    window.addEventListener('online',on);window.addEventListener('offline',off);
    window.addEventListener('beforeinstallprompt',prompt);
    window.addEventListener('appinstalled',saved);
    if('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/app/sw.js',{scope:'/app/'}).catch(()=>{});
    return () => {window.removeEventListener('hashchange',route);window.removeEventListener('online',on);window.removeEventListener('offline',off);window.removeEventListener('beforeinstallprompt',prompt);window.removeEventListener('appinstalled',saved);window.removeEventListener('storage',storage);};
  },[]);
  const heading = page==='calendar'?'A little easier to plan.':page==='search'?'Find your next tap.':page==='more'?'All things RCAP.':groups[page]?.title || 'RCAP Family Hub';
  useEffect(() => {
    document.title = heading+' | We Are RCAP';
    if(first.current) first.current=false;
    else {(page==='search'?searchInput:title).current?.focus({preventScroll:true});window.scrollTo(0,0);}
  },[page,heading]);
  function go(next) {setQuery('');location.hash=next;}
  const filtered = [...links,...(online ? albums : [])].filter(link=>(link.title+' '+link.detail+' '+link.group).toLowerCase().includes(query.trim().toLowerCase()));
  const activeNav = ['home','updates','photos'].includes(page)?page:'more';
  const intro = page==='calendar'?'Your next school dates, one month at a time.':page==='search'?'Search tools, resources, and ways to connect.':page==='more'?'The full directory, whenever you need it.':groups[page]?.intro;
  return <div className="hub">
    <a className="skip" href="#content">Skip to content</a>
    <header className="topbar">
      <a href="#home" className="brand" aria-label="RCAP Family Hub home"><img src="/brand/we-are-rcap.svg" alt="We Are RCAP"/><span>FAMILY HUB</span></a>
      <div className="header-actions"><button onClick={openInstall} aria-label="How to add We Are RCAP to your Home Screen" className="install-top"><Smartphone size={19}/><span>{installed||installHidden?'Home screen help':'Add to Home Screen'}</span></button><button className="circle" onClick={()=>go(page==='search'?'home':'search')} aria-label={page==='search'?'Close search':'Search RCAP'}>{page==='search'?<X size={21}/>:<Search size={21}/>}</button></div>
    </header>
    {!online&&<div className="offline" role="status">You’re offline. Your saved hub and calendar are here; tools and galleries need a connection.</div>}
    <main id="content">
      {page==='home'?<>
        <section className="welcome">
          <div className="welcome-photo" aria-hidden="true"><img src="/app-assets/community-wide.jpg" alt="" fetchPriority="high"/></div>
          <div className="welcome-copy"><p className="eyebrow"><span/> ONE COMMUNITY. EVERY FAMILY.</p><h1 ref={title} tabIndex={-1}>Your RCAP.<br/><em>Right here.</em></h1><p>Everything you reach for.<br/>The community you belong to.</p></div>
        </section>
        {!installed&&!installHidden&&<aside className="install-save-card install-nudge" aria-label="Save We Are RCAP">
          <button className="install-nudge-open" onClick={openInstall}><img src="/app-assets/we-are-rcap-180.png" width="58" height="58" alt="We Are RCAP app icon"/><span><strong>Add We Are RCAP to your Home Screen</strong><small>Save this icon. Open RCAP like an app.</small><b>Show me how <ArrowRight size={14}/></b></span></button>
          <button className="install-nudge-dismiss" onClick={()=>hideInstall()} aria-label="Dismiss home screen setup"><X size={18}/></button>
        </aside>}
        <NextUp/>
        <section className="quick-section" aria-labelledby="quick-title">
          <div className="section-heading"><h2 id="quick-title">What do you need today?</h2><span>LET’S GET YOU THERE</span></div>
          <div className="tile-grid">{tiles.map(tile=>{
            const inside=<><span className={'tile-icon '+tile.color}><Icon name={tile.icon} size={29}/></span><span>{tile.title}</span></>;
            return tile.href?<a className="tile" href={tile.href} key={tile.title}>{inside}</a>:<button className="tile" onClick={()=>go(tile.page)} key={tile.title}>{inside}</button>;
          })}</div>
        </section>
        <Announcements/>
      </>:<>
        <div className="page-heading"><button className="back" onClick={()=>go('home')} aria-label="Back to home"><ArrowLeft size={21}/></button><p className="eyebrow">YOUR RCAP FAMILY HUB</p><h1 ref={title} tabIndex={-1}>{heading}</h1><p>{intro}</p></div>
        {(page==='search'||page==='more')&&<label className="search-box"><Search size={21} aria-hidden="true"/><input ref={searchInput} autoFocus={page==='search'} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search RCAP tools…" aria-label="Search RCAP tools" type="search"/>{query&&<button onClick={()=>setQuery('')} aria-label="Clear search"><X size={19}/></button>}</label>}
        {page==='calendar'?<Calendar/>:page==='photos'?<>
          <a className="capsule-feature" href="/rcap-capsule/"><span className="icon-box rose"><Camera size={29} aria-hidden="true"/></span><span><small>OUR SCHOOL-WIDE PHOTO HOME</small><strong>The RCAP Capsule</strong><span>Browse every album, share a memory, or add your own.</span></span><ArrowUpRight size={23} aria-hidden="true"/></a>
          <section className="album-pullouts"><h2>Inside the Capsule</h2><p>Jump into a school-wide album.</p>
            {albumStatus==='loading'?<p role="status">Finding the latest albums…</p>:albumStatus==='error'?<div className="album-unavailable" role="status"><p>We couldn’t check the album list right now. You can still open the Capsule above.</p><button onClick={retry}>Try again</button></div>:albums.length?<ToolList items={albums}/>:<p>New albums will appear here when they’re available in the Capsule.</p>}
          </section>
        </>:page==='updates'?<><Announcements/><NewsletterCard/><ToolList items={links.filter(link=>link.group==='updates'&&link.id!=='newsletter'&&!announcements.some(item=>item.href===link.href))}/></>:page==='resources'?<>
          {['resources','involved'].map(key=><section className="catalog-group" key={key}><h2>{key==='resources'?'Guides & forms':'Ways to help'}</h2><ToolList items={links.filter(link=>link.group===key)}/></section>)}
        </>:page==='search'?<>
          <p className="result-count" role="status">{filtered.length} {filtered.length===1?'result':'results'}</p><ToolList items={filtered}/>
          {!filtered.length&&<div className="empty"><Search size={30}/><h2>No tools found</h2><p>Try “photos,” “uniforms,” or “volunteer.”</p><button onClick={()=>setQuery('')}>Show all tools</button></div>}
        </>:page==='more'?<>
          {Object.entries(groups).map(([key,group])=>{const items=filtered.filter(link=>link.group===key);return items.length?<section className="catalog-group" key={key}><h2>{group.title}</h2><ToolList items={items}/></section>:null;})}
          {filtered.some(link=>link.group==='albums')&&<section className="catalog-group"><h2>Inside the RCAP Capsule</h2><ToolList items={filtered.filter(link=>link.group==='albums')}/></section>}
          {query&&!filtered.length&&<p className="empty" role="status">No tools found. Try a different search.</p>}
        </>:<ToolList items={links.filter(link=>link.group===page)}/>}
      </>}
      <footer className="footer"><img src="/brand/rcap.svg" alt="RCAP. Ron Clark Academy Parents"/><span>Built by parents. For our community.</span><a href="/">Visit the full website <Globe size={14}/><ArrowUpRight size={13}/></a></footer>
    </main>
    <nav className="bottom-nav" aria-label="Main navigation">{nav.map(([key,label,Component])=><a key={key} href={'#'+key} className={activeNav===key?'active':''} aria-current={activeNav===key?'page':undefined}><span><Component size={22} strokeWidth={activeNav===key?2.2:1.7}/></span>{label}</a>)}</nav>
    <InstallGuide dialogRef={dialog} install={install} setInstall={setInstall} onSaved={()=>{hideInstall('confirmed');dialog.current.close();}}/>
  </div>;
}
createRoot(document.getElementById('root')).render(<CommunityProvider><App/></CommunityProvider>);
