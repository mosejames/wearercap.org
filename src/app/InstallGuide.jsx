import React, {useState} from 'react';
import {X,Share,PlusSquare,Download,Check,MoreVertical,ArrowUpRight} from 'lucide-react';
export default function InstallGuide({dialogRef,install,setInstall,onSaved}) {
  const [device,setDevice] = useState('iphone');
  return <dialog ref={dialogRef} className="install-dialog" onClick={e=>{if(e.target===dialogRef.current)dialogRef.current.close();}}>
    <div className="dialog-top"><span className="eyebrow">YOUR COMMUNITY. ONE TAP AWAY.</span><button className="circle" onClick={()=>dialogRef.current.close()} aria-label="Close home screen guide"><X size={22}/></button></div>
    <div className="install-app-preview"><img src="/app-assets/we-are-rcap-180.png" width="88" height="88" alt="We Are RCAP: blue square with white RCA and gold P"/><strong>We Are RCAP</strong><span>This is the icon you’ll look for on your phone.</span></div>
    <h2>Add We Are RCAP to your Home Screen.</h2>
    <p>Keep your newsletters, calendar, photos, and family tools together. No App Store download needed.</p>
    <div className="device-choices" aria-label="Choose your device">{[['iphone','iPhone / iPad'],['android','Android'],['computer','Computer']].map(([key,label])=><button key={key} aria-pressed={device===key} onClick={()=>setDevice(key)}>{label}</button>)}</div>
    {device==='iphone'?<div className="device-instructions">
      <h3>On your iPhone or iPad</h3>
      <ol><li><strong>Open this page in Safari.</strong><span>Go to <a href="https://wearercap.org/app/">wearercap.org/app/</a>. If you’re inside Instagram, Facebook, or an email app, use its menu to open the link in Safari first.</span></li>
      <li><strong>Tap <Share size={17} aria-hidden="true"/> Share.</strong><span>Look for the square with the arrow pointing up. It may be inside Safari’s <strong>More</strong> menu.</span></li>
      <li><strong>Choose <PlusSquare size={17} aria-hidden="true"/> Add to Home Screen.</strong><span>Scroll through the Share options to find it. If it’s missing, check <strong>Edit Actions</strong> and add it to the list.</span></li>
      <li><strong>Save it as “We Are RCAP.”</strong><span>If you see <strong>Open as Web App</strong>, turn it on. Keep the name <strong>We Are RCAP</strong>, then tap <strong>Add</strong>.</span></li>
      <li><strong>You’re ready.</strong><span>Go to your Home Screen and tap the blue <strong>We Are RCAP</strong> icon. It opens in its own app window.</span></li></ol>
      <a className="install-help" href="https://support.apple.com/guide/iphone/iphea86e5236/ios" target="_blank" rel="noopener noreferrer">iPhone instructions from Apple <ArrowUpRight size={13}/></a>
    </div>:device==='android'?<div className="device-instructions">
      <h3>On your Android phone</h3>
      <ol><li><strong>Open this page in Chrome.</strong><span>Go to <a href="https://wearercap.org/app/">wearercap.org/app/</a>.</span></li><li><strong>Open the <MoreVertical size={17} aria-hidden="true"/> three-dot menu.</strong><span>Choose <strong>Add to Home screen</strong>, then <strong>Install</strong>. Some phones show <strong>Install app</strong> directly.</span></li><li><strong>Confirm and open We Are RCAP.</strong><span>Tap <strong>Install</strong> or <strong>Add</strong> when asked. Look for the blue <strong>We Are RCAP</strong> icon on your Home Screen or in your app list.</span></li></ol>
      {install&&<button className="primary-button" onClick={async()=>{await install.prompt();await install.userChoice;setInstall(null);}}>Install We Are RCAP <Download size={18}/></button>}
      <a className="install-help" href="https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid" target="_blank" rel="noopener noreferrer">Android instructions from Google <ArrowUpRight size={13}/></a>
    </div>:<div className="device-instructions"><h3>On your computer</h3><ol><li><strong>Open this page in Chrome or Edge.</strong><span>Go to <a href="https://wearercap.org/app/">wearercap.org/app/</a>.</span></li><li><strong>Choose Install.</strong><span>Look for the install icon in the address bar, or open the browser menu and find <strong>Install We Are RCAP</strong> or <strong>Install this site as an app</strong>.</span></li><li><strong>Open We Are RCAP.</strong><span>Find it with your other apps and pin it to your Dock or taskbar if you’d like. On a Mac in Safari, you can also choose <strong>File → Add to Dock</strong>.</span></li></ol>{install&&<button className="primary-button" onClick={async()=>{await install.prompt();await install.userChoice;setInstall(null);}}>Install We Are RCAP <Download size={18}/></button>}</div>}
    <div className="install-finish"><Check size={19} aria-hidden="true"/><p><strong>Next time, just tap the icon.</strong><span>There’s no new account to create for the hub. Individual family tools keep their usual sign-in. Newsletters and galleries need an internet connection.</span></p></div>
    <p className="install-existing">Saved an earlier RCAP icon? Add this page again to pick up the new artwork.</p>
    <button className="primary-button" onClick={onSaved}>I’ve added it <Check size={18}/></button><button className="install-later" onClick={()=>dialogRef.current.close()}>Close instructions</button>
  </dialog>;
}
