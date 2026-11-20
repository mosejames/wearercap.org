import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, Share2, Upload } from 'lucide-react';
import TrimTimeline from './TrimTimeline.jsx';
import { renderVideo } from './render-video.js';

const MAX_LENGTH = 30;

function useFileUrl(file) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = file ? URL.createObjectURL(file) : '';
    setUrl(next);
    return () => { if (next) URL.revokeObjectURL(next); };
  }, [file]);
  return url;
}

export default function VideoEditor({ file, card, storage, onBusy }) {
  const sourceUrl = useFileUrl(file);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [time, setTime] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null);
  const [delivery, setDelivery] = useState('');
  const outputUrl = useFileUrl(result?.file);
  const preview = useRef(null);

  async function loadPreview() {
    const video = preview.current;
    if (video.videoWidth >= video.videoHeight) {
      setError('Please choose a video recorded with your phone upright in portrait.');
      return;
    }
    let length = video.duration;
    if (!Number.isFinite(length) || length <= 0) {
      // MediaRecorder WebM files can omit the container duration.
      try {
        const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny');
        const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
        try { length = await input.computeDuration(); }
        finally { input.dispose(); }
      } catch { length = 0; }
    }
    if (preview.current !== video) return;
    if (!Number.isFinite(length) || length <= 0) {
      setError('We couldn’t read the length of this video. Try recording again or uploading an MP4.');
      return;
    }
    setDuration(length);
    setEnd(Math.min(length, MAX_LENGTH));
  }

  function seek(time) {
    preview.current.pause();
    preview.current.currentTime = time;
    setTime(time);
  }

  async function deliver(clip) {
    setDelivery('sending');
    try {
      const { error: uploadError } = await storage.from('thankful-at-rca').upload(clip.path, clip.file, {
        contentType: 'video/mp4',
        metadata: { family: clip.family, prompt: clip.prompt, consent: true },
      });
      if (uploadError && Number(uploadError.statusCode) !== 409) throw uploadError;
      setDelivery('sent');
    } catch {
      setDelivery('failed');
    } finally {
      onBusy(false);
    }
  }

  async function create(event) {
    event.preventDefault();
    const family = new FormData(event.currentTarget).get('family').trim();
    if (!family) return setError('Enter your name before continuing.');
    if (!storage) return setError('Video submissions are temporarily unavailable. Please try again later.');
    if (!duration || end <= start || end - start > MAX_LENGTH + .01) return;
    preview.current.pause();
    setError('');
    setProgress(0);
    onBusy(true);
    try {
      const finished = await renderVideo(file, { start, end, onProgress: setProgress });
      const clip = {
        file: finished, family, prompt: card[0],
        path: `2026/${card[0].toLowerCase()}/${crypto.randomUUID()}.mp4`,
      };
      setResult(clip);
      void deliver(clip);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We couldn’t finish your video. Please try again.');
      onBusy(false);
    } finally {
      setProgress(null);
    }
  }

  async function share() {
    try {
      await navigator.share({ files: [result.file], title: 'Thankful at RCA' });
    } catch (cause) {
      if (cause.name !== 'AbortError') setError('Sharing didn’t open. Download the video to share it from your phone.');
    }
  }

  if (result) return <div className="editor">
    <h3>Your finished video</h3>
    <video className="preview" src={outputUrl} controls playsInline/>
    <div className="file-actions">
      <a className="button" href={outputUrl || undefined} download={result.file.name}><Download size={16}/> Download</a>
      {navigator.canShare?.({ files: [result.file] }) && <button className="button" type="button" onClick={share}><Share2 size={16}/> Share</button>}
    </div>
    <p className="hint" role="status">
      {delivery === 'sent' ? <><Check size={14}/> RCAP received your clip.</> :
        delivery === 'sending' ? 'Sending your finished clip to RCAP. Keep this page open.' :
          'Your video is ready to keep. The copy for RCAP still needs to be sent.'}
    </p>
    {delivery === 'failed' && <button className="text-link" type="button" onClick={() => { onBusy(true); void deliver(result); }}>Retry submission</button>}
    {error && <p className="error" role="alert">{error}</p>}
  </div>;

  const rendering = progress !== null;
  return <form className="editor" onSubmit={create}>
    <fieldset disabled={rendering}>
      <div className="preview-frame">
        <video ref={preview} className="preview" src={sourceUrl} playsInline controls preload="auto"
          onLoadedMetadata={loadPreview} onError={() => { if (sourceUrl) setError('This video couldn’t be opened. Try saving a copy as an MP4.'); }}
          onPlay={() => { if (preview.current.currentTime < start || preview.current.currentTime >= end) preview.current.currentTime = start; }}
          onTimeUpdate={() => {
            const video = preview.current;
            setTime(video.currentTime);
            if (end && video.currentTime >= end) video.pause();
          }} />
        <img src="/images/we-are-rcap-logo.png" alt="We Are RCAP" />
      </div>
      {duration > 0 && <TrimTimeline file={file} duration={duration} start={start} end={end} time={time}
        limit={MAX_LENGTH} onSeek={seek} onTrim={(edge, value) => {
          (edge === 'start' ? setStart : setEnd)(value);
          seek(value);
        }}/>}
      <label htmlFor="family">Your name</label>
      <input id="family" name="family" autoComplete="name" maxLength={100} required />
      <label className="consent"><input type="checkbox" required/><span>I have permission from everyone shown, including a parent or guardian for any child, and I give RCAP permission to use this clip in its Thanksgiving video.</span></label>
      <button className="button" type="submit" disabled={!duration}><Upload size={17}/>{rendering ? 'Creating your video…' : 'Finish and send'}</button>
      {rendering && <progress aria-label="Creating your video" max="1" value={progress} />}
      {error && <p className="error" role="alert">{error}</p>}
    </fieldset>
  </form>;
}
