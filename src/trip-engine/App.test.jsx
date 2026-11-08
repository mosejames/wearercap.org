import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
vi.mock('../trip-studio/client.js',()=>({authClient:vi.fn()}));
vi.mock('./data.js',()=>({gallery:vi.fn(),upload:vi.fn(),request:vi.fn(),photoShareUrl:(slug,p)=>`https://wearercap.org/trips/${slug}/e/${p.album}/p/${p.id}`,downloadUrl:()=>'/api/trip-engine?action=download',browserToken:()=> 'a'.repeat(64)}));
import App from './App.jsx';
import {authClient} from '../trip-studio/client.js';
import {gallery,request} from './data.js';
let host,root;
const trip={slug:'verification-trip',engineId:'11111111-1111-1111-1111-111111111111',phase:'Active trip',destination:'Verification trip',cohort:'2035',start:'2030-01-01',end:'2030-01-02',timezone:'America/New_York',logo:'data:image/png;base64,AAAA',colors:{navy:'#102448',yellow:'#f5cc48',paper:'#faf9f4'},features:{remember:true,milestones:true,download:true,conversations:false,videos:false},groups:['Group A','Group AA','Mixed'],milestones:[{count:100,label:'First 100 in {destination}'}]};
const photo=(id,group='Group A',album='the-whole-adventure')=>({id,tripId:trip.engineId,album,group,contributor:'Chaperone',thumb:`${id}.jpg`,web:`${id}-web.jpg`,createdAt:'2030-01-01T12:00:00Z'});
function button(text){return[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===text);}
async function click(text){await act(async()=>button(text).click());}
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;history.replaceState(null,'','/trip-vault/?trip=verification-trip');const memory=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}});HTMLDialogElement.prototype.showModal=vi.fn();HTMLDialogElement.prototype.close=vi.fn();authClient.mockReturnValue({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}})}});gallery.mockReset().mockResolvedValue({trip,photos:[],count:0,hasMore:false,isAdmin:false});request.mockReset();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();history.replaceState(null,'','/');vi.clearAllMocks();});
it('opens one configured trip and keeps the stable link in the address bar',async()=>{await act(async()=>root.render(<App/>));expect(host.textContent).toContain('CLASS OF 2035');expect(location.pathname).toBe('/trips/verification-trip/');expect(host.querySelector('.engine-milestone-count b').textContent).toBe('0');expect(host.textContent).toContain('photos. One big adventure.');expect(host.textContent).not.toContain('NYC');});
it('does not show a draft configuration when the public lookup is unavailable',async()=>{gallery.mockRejectedValue(Object.assign(Error('Trip not available'),{status:404}));await act(async()=>root.render(<App/>));expect(host.textContent).toContain('This trip is not open');expect(host.textContent).not.toContain('2035');expect(host.querySelector('input[type=file]')).toBeNull();});
it('keeps Mixed photos visible with either group filter',async()=>{gallery.mockResolvedValue({trip,photos:[photo('a'),photo('b','Group AA'),photo('c','Mixed')],count:3,hasMore:false});await act(async()=>root.render(<App/>));await click('Group A');expect(host.querySelector('.engine-gallery img[src="a.jpg"]')).not.toBeNull();expect(host.querySelector('.engine-gallery img[src="b.jpg"]')).toBeNull();expect(host.querySelector('.engine-gallery img[src="c.jpg"]')).not.toBeNull();});
it('remembers a batch’s group and omits a scholar-name field in regular intake',async()=>{await act(async()=>root.render(<App/>));await click('Add trip photos');await act(async()=>{const select=host.querySelector('dialog select');select.value='Group AA';select.dispatchEvent(new Event('change',{bubbles:true}));});expect(localStorage.getItem('trip-engine:verification-trip:group')).toBe('Group AA');expect(host.querySelector('dialog').textContent).toContain('Chaperone name');expect([...host.querySelectorAll('dialog label')].some(l=>l.textContent.includes('Scholar'))).toBe(false);expect(host.querySelector('dialog input[type=file]').accept).not.toContain('video');});
it('closes intake in Archive without removing gallery viewing',async()=>{gallery.mockResolvedValue({trip:{...trip,phase:'Archive'},photos:[photo('a')],count:1,hasMore:false});await act(async()=>root.render(<App/>));expect(button('Add trip photos')).toBeUndefined();expect(host.textContent).toContain('New uploads are closed');expect(host.querySelector('.engine-gallery img')).not.toBeNull();});
it('opens an exact deep-linked photo even when it is beyond the first gallery page',async()=>{history.replaceState(null,'','/trip-vault/?trip=verification-trip&photo=target&album=send-off');gallery.mockImplementation(async(_slug,args)=>args?.photo?{trip,photos:[photo('target','Mixed','send-off')],count:1}:{trip,photos:[photo('other')],count:101,hasMore:true});await act(async()=>root.render(<App/>));expect(host.querySelector('dialog .engine-viewer img').src).toContain('target-web.jpg');expect(host.querySelector('dialog .engine-viewer img').src).not.toContain('other');});

it('gives Washington DC its custom design and a working invitation guide',async()=>{gallery.mockResolvedValue({trip:{...trip,destination:'Washington, DC',cohort:'2030'},photos:[],count:0,hasMore:false});await act(async()=>root.render(<App/>));expect(host.querySelector('.engine-dc')).not.toBeNull();expect(host.textContent).toContain('Big history.');expect(host.querySelector('#downloads')).not.toBeNull();await click('Full-trip downloads');expect(host.querySelector('dialog').textContent).toContain('private download invitation');expect(host.querySelector('dialog input[type=email]')).toBeNull();});
it('does not add the DC design or download section to other configured trips',async()=>{await act(async()=>root.render(<App/>));expect(host.querySelector('.engine-dc')).toBeNull();expect(host.querySelector('#downloads')).toBeNull();expect(host.querySelector('.engine-intro')).not.toBeNull();});
it('omits the two presentation sections on the DC 2030 page while retaining photo downloads and admin access',async()=>{
 gallery.mockResolvedValue({trip:{...trip,slug:'washington-dc-2030',destination:'Washington, DC',cohort:'2030',start:'2026-11-08',end:'2026-11-10'},photos:[photo('a')],count:1,hasMore:false});
 await act(async()=>root.render(<App/>));
 expect(host.querySelector('.engine-trip-guide')).toBeNull();
 expect(host.querySelector('#downloads')).toBeNull();
 expect(host.textContent).not.toContain('THE ADVENTURE AHEAD');
 expect(host.textContent).not.toContain('THE MEMORIES COME HOME');
 expect(button('Admin login')).toBeDefined();
 await act(async()=>host.querySelector('.engine-gallery>button').click());
 expect(host.querySelector('dialog a[href="/api/trip-engine?action=download"]')).not.toBeNull();
});
it('keeps another DC cohort from inheriting the 2030 itinerary',async()=>{
 gallery.mockResolvedValue({trip:{...trip,slug:'washington-dc-2031',destination:'Washington, DC',cohort:'2031'},photos:[],count:0,hasMore:false});
 await act(async()=>root.render(<App/>));expect(host.querySelector('.engine-trip-guide')).toBeNull();
});
it('uses one DC gallery and needs no group selection even when this device remembered Group A',async()=>{
 localStorage.setItem('trip-engine:verification-trip:group','Group A');
 gallery.mockResolvedValue({trip:{...trip,slug:'washington-dc-2030',destination:'Washington, DC',cohort:'2030'},photos:[photo('a'),photo('b','Group AA')],count:2,hasMore:false});
 await act(async()=>root.render(<App/>));
 expect(host.querySelector('.engine-group-filters')).toBeNull();
 expect(host.querySelectorAll('.engine-gallery>button')).toHaveLength(2);
 expect(host.textContent).not.toContain('All groups');
 await click('Add trip photos');
 expect(host.querySelector('dialog input[type=radio]')).toBeNull();
 expect(host.querySelector('dialog').textContent).not.toContain('Change groups');
});
it('offers the configured DC video request in the hero and photo form without enabling video files in photo intake',async()=>{
 const url='https://www.dropbox.com/request/dc-verification';
 gallery.mockResolvedValue({trip:{...trip,slug:'washington-dc-2030',destination:'Washington, DC',features:{...trip.features,videos:true},videoUploadUrl:url},photos:[],count:0,hasMore:false});
 await act(async()=>root.render(<App/>));
 expect(host.querySelector('.dc-video-link').href).toBe(url);
 expect(host.querySelector('.dc-video-link').rel).toContain('noopener');
 await click('Add trip photos');
 await click('Send videos ↗');expect(host.querySelector('dialog a[href="'+url+'"]').rel).toContain('noopener');await click('Back to photos');
 expect(host.querySelector('dialog input[type=file]').accept).not.toContain('video');
});
it('does not show a video upload link when DC collection is disabled or the trip is archived',async()=>{
 gallery.mockResolvedValue({trip:{...trip,slug:'washington-dc-2030',destination:'Washington, DC',phase:'Archive',features:{...trip.features,videos:true},videoUploadUrl:'https://www.dropbox.com/request/dc-verification'},photos:[],count:0,hasMore:false});
 await act(async()=>root.render(<App/>));expect(host.querySelector('.dc-video-link')).toBeNull();
});
it('renders an isolated draft preview without authentication or gallery requests, including deep-link query strings',async()=>{history.replaceState(null,'','/trip-studio/?photo=private-id&album=send-off');authClient.mockClear();gallery.mockClear();const before=location.href;await act(async()=>root.render(<App previewTrip={{...trip,hero:'data:image/png;base64,AAAA',start:'',end:''}}/>));expect(host.textContent).toContain('Trip dates to come');expect(host.querySelector('.scenic-hero').style.getPropertyValue('--dc-hero-art')).toContain('data:image/png');expect(authClient).not.toHaveBeenCalled();expect(gallery).not.toHaveBeenCalled();expect(location.href).toBe(before);});

it('uses the full scenic backdrop for a future vault with selected artwork without adding DC-specific tools',async()=>{gallery.mockResolvedValue({trip:{...trip,destination:'College Park GA',hero:'data:image/jpeg;base64,AAAA'},photos:[],count:0,hasMore:false});await act(async()=>root.render(<App/>));expect(host.querySelector('.engine-scenic')).not.toBeNull();expect(host.querySelector('.engine-intro')).toBeNull();expect(host.querySelector('.engine-hero')).toBeNull();expect(host.querySelector('.scenic-hero').textContent).toContain('Big memories.');expect(host.querySelector('.scenic-destination').textContent).toBe('College Park GA');expect(host.querySelector('.dc-appreciation-entry')).toBeNull();expect(host.querySelector('.dc-downloads')).toBeNull();await click('Add trip photos');expect(host.querySelector('dialog .upload-next')).not.toBeNull();});

it('uses configured milestone numbers for the live progress display',async()=>{gallery.mockResolvedValue({trip:{...trip,milestones:[{count:50,label:'First fifty shared'},{count:200,label:'Two hundred moments'},{count:1000,label:'A thousand memories'}]},photos:[],count:51,hasMore:false});await act(async()=>root.render(<App/>));expect(host.querySelector('[role=progressbar]').getAttribute('aria-valuemax')).toBe('200');expect(host.querySelector('.engine-milestone').textContent).toContain('First fifty shared');expect(host.querySelector('.engine-milestone').textContent).toContain('200 · Two hundred moments');});
it('replaces the DC guide with prompts and carries the selected moment into the uploader',async()=>{
 gallery.mockResolvedValue({trip:{...trip,slug:'washington-dc-2030',destination:'Washington, DC',cohort:'2030',phase:'Send-off'},photos:[],count:0,hasMore:false});
 await act(async()=>root.render(<App/>));
 expect(host.querySelector('.before-trip')).toBeNull();
 expect(host.querySelector('#gallery .dc-moment-prompts')).not.toBeNull();
 await click('🤗 Goodbye hugs');
 expect(host.querySelector('dialog .upload-next h3').textContent).toBe('Goodbye hugs');
});
it('keeps a direct chaperone sign-in after removing the guide',async()=>{
 history.replaceState(null,'','/trip-vault/?trip=washington-dc-2030');
 gallery.mockResolvedValue({trip:{...trip,slug:'washington-dc-2030',destination:'Washington, DC',phase:'Active trip'},photos:[],count:0,hasMore:false});
 await act(async()=>root.render(<App/>));
 expect(host.querySelector('.dc-moment-pills button').textContent).toContain('First stop');
 await click('Chaperone sign-in');
 expect(localStorage.getItem('trip-engine:washington-dc-2030:role')).toBe('chaperone');
 expect(host.querySelector('dialog').textContent).toContain('Continue with RCA Google');
});
function touchEvent(target,type,points){const event=new Event(type,{bubbles:true});Object.defineProperty(event,type==='touchend'?'changedTouches':'touches',{value:points});target.dispatchEvent(event);}
async function openViewer(){gallery.mockResolvedValue({trip,photos:[photo('a'),photo('b'),photo('c')],count:3,hasMore:false});await act(async()=>root.render(<App/>));await act(async()=>host.querySelector('.engine-gallery>button').click());}
it('puts labelled navigation arrows beside the photo and respects album edges',async()=>{await openViewer();const previous=()=>host.querySelector('.engine-viewer button[aria-label="Previous photo"]'),next=()=>host.querySelector('.engine-viewer button[aria-label="Next photo"]');expect(previous().disabled).toBe(true);expect(next().textContent).toBe('');expect(host.querySelector('.engine-viewer-nav')).toBeNull();await act(async()=>next().click());expect(location.search).toContain('photo=b');await act(async()=>next().click());expect(next().disabled).toBe(true);await act(async()=>previous().click());expect(location.search).toContain('photo=b');});
it('swipes both directions without treating vertical scrolling as a photo change',async()=>{await openViewer();const viewer=host.querySelector('.engine-viewer');async function swipe(x,y){await act(async()=>{touchEvent(viewer,'touchstart',[{clientX:200,clientY:200}]);touchEvent(viewer,'touchend',[{clientX:x,clientY:y}]);});}await swipe(80,205);expect(location.search).toContain('photo=b');await swipe(320,205);expect(location.search).toContain('photo=a');await swipe(190,40);expect(location.search).toContain('photo=a');await swipe(320,205);expect(location.search).toContain('photo=a');});
it('ignores cancelled and multi-finger gestures and supports keyboard arrows',async()=>{await openViewer();const viewer=host.querySelector('.engine-viewer');await act(async()=>{touchEvent(viewer,'touchstart',[{clientX:200,clientY:200}]);touchEvent(viewer,'touchcancel',[]);touchEvent(viewer,'touchend',[{clientX:40,clientY:200}]);});expect(location.search).toContain('photo=a');await act(async()=>{touchEvent(viewer,'touchstart',[{clientX:200,clientY:200}]);touchEvent(viewer,'touchmove',[{clientX:180,clientY:200},{clientX:220,clientY:200}]);touchEvent(viewer,'touchend',[{clientX:40,clientY:200}]);});expect(location.search).toContain('photo=a');await act(async()=>viewer.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));expect(location.search).toContain('photo=b');});
it('has one header close button and clears the exact-photo URL',async()=>{await openViewer();expect(host.querySelectorAll('dialog button[aria-label="Close"]')).toHaveLength(1);expect(host.querySelector('.engine-photo-close')).toBeNull();await act(async()=>host.querySelector('dialog button[aria-label="Close"]').click());expect(host.querySelector('dialog')).toBeNull();expect(location.search).not.toContain('photo=');expect(host.querySelector('.engine-gallery')).not.toBeNull();});
it('dismisses only a true backdrop click, while photo and dialog padding clicks stay open',async()=>{await openViewer();const dialog=host.querySelector('dialog');dialog.getBoundingClientRect=()=>({left:100,right:600,top:100,bottom:700});await act(async()=>dialog.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:120,clientY:120})));expect(host.querySelector('dialog')).not.toBeNull();await act(async()=>host.querySelector('.engine-viewer img').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:200,clientY:200})));expect(host.querySelector('dialog')).not.toBeNull();await act(async()=>dialog.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:20,clientY:200})));expect(host.querySelector('dialog')).toBeNull();expect(location.search).not.toContain('photo=');});
it('keeps Escape dismissal and protects upload dialogs from backdrop dismissal',async()=>{await openViewer();await act(async()=>host.querySelector('dialog').dispatchEvent(new Event('cancel',{bubbles:true,cancelable:true})));expect(host.querySelector('dialog')).toBeNull();await click('Add trip photos');const dialog=host.querySelector('dialog');dialog.getBoundingClientRect=()=>({left:100,right:600,top:100,bottom:700});await act(async()=>dialog.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:20,clientY:200})));expect(host.querySelector('dialog')).not.toBeNull();});
