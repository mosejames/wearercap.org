let tracker;
export function trackActivity(event){tracker?.event(event);}
export function startActivity(page){
 if(tracker || navigator.webdriver)return;
 let visitor;try{visitor=localStorage.getItem('london-analytics-visitor');if(!visitor){visitor=crypto.randomUUID();localStorage.setItem('london-analytics-visitor',visitor);}}catch{visitor=crypto.randomUUID();}
 let session=crypto.randomUUID(),started=Date.now(),counts={};let seconds=0,lastTick=started,lastInput=started,inFlight=false;
 function active(){return document.visibilityState==='visible' && Date.now()-lastInput<60000;}
 function tick(){const now=Date.now();if(active())seconds+=Math.min(5,(now-lastTick)/1000);lastTick=now;}
 function send(beacon=false,leaving=false){
  tick();if(Date.now()-started>86400000){session=crypto.randomUUID();started=Date.now();counts={};seconds=0;}const body=JSON.stringify({session,visitor,page,started,seconds:Math.floor(seconds),active:!leaving && active(),counts});
  if(beacon){navigator.sendBeacon?.('/api/london-activity',new Blob([body],{type:'application/json'}));return;}
  if(inFlight)return;inFlight=true;fetch('/api/london-activity',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{}).finally(()=>{inFlight=false;});
 }
 tracker={event(name){counts[name]=(counts[name]||0)+1;send();}};
 for(const type of ['pointerdown','keydown','scroll','touchstart'])window.addEventListener(type,()=>{tick();lastInput=Date.now();},{passive:true});
 setInterval(tick,5000);setInterval(()=>{if(document.visibilityState==='visible')send();},30000);
 document.addEventListener('visibilitychange',()=>send(document.visibilityState!=='visible',document.visibilityState!=='visible'));
 window.addEventListener('pagehide',()=>send(true,true));send();
}
