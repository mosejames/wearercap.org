export function track(event,issue='current'){
 if(navigator.webdriver||navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
 const body=JSON.stringify({id:crypto.randomUUID(),event,issue});
 fetch('/api/campaign-activity',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
}
if(location.pathname.startsWith('/newsletter/')&&!location.pathname.includes('/builder'))track('newsletterView',location.pathname.split('/').filter(Boolean).at(-1));
