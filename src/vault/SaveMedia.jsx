import { useEffect, useState } from 'react';
import { mediaUrl } from './data.js';
import { isVideo } from './videos.js';
import { prepareSaveFile, canSaveToPhotos } from './saveMedia.js';

export function SaveMedia({ photo, onClose }) {
  const [file,setFile]=useState(null),[blobUrl,setBlobUrl]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[sharing,setSharing]=useState(false);
  const original=mediaUrl(photo,'orig');
  const gif=photo.contentType==='image/gif'||/\.gif$/i.test(photo.key||'');
  useEffect(()=>{
    const controller=new AbortController();let objectUrl;
    prepareSaveFile(photo,original,controller.signal).then(f=>{
      if(controller.signal.aborted)return;
      objectUrl=URL.createObjectURL(f);setFile(f);setBlobUrl(objectUrl);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[photo.id,original]);
  const supported=canSaveToPhotos(file);
  const nativePossible=typeof navigator.share==='function'&&typeof navigator.canShare==='function';
  const save=async()=>{
    setSharing(true);setError('');
    try {
      // The file is already prepared: native sharing must start within this tap.
      await navigator.share({files:[file]});
      onClose();
    } catch(e) {if(e.name!=='AbortError')setError('Your phone could not open its save options. Use Download file below.');}
    finally {setSharing(false);}
  };
  return <div className="stack save-media">
    {(supported||(loading&&nativePossible))&&<><button className="btn primary" disabled={loading||sharing} onClick={save}>{loading?(gif||isVideo(photo)?'Preparing video…':'Preparing photo…'):sharing?'Opening save options…':'Save to Photos'}</button><p className="fine">Choose “{isVideo(photo)||gif?'Save Video':'Save Image'}” in your phone’s share sheet if available.</p></>}
    {gif&&<p className="fine">GIF animations are prepared as MP4 videos for your photo library.</p>}
    {!loading&&!supported&&<p className="fine">This browser doesn’t offer saving this file to Photos. Download it below, or open the original to use your phone’s save options.</p>}
    {loading&&!nativePossible&&<p className="fine" role="status">Preparing download…</p>}
    {file && <a className="btn ghost" href={blobUrl} download={file.name}>Download {gif?'video':'file'}</a>}
    <a className="link" href={original} target="_blank" rel="noopener">{gif?'Open original GIF':'Open original'}</a>
    {error&&<p className="err" role="alert">{error}</p>}
  </div>;
}
