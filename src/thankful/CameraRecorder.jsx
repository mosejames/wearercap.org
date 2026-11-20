import React, { useEffect, useRef, useState } from 'react';
import { Camera, Mic, Smartphone, Sun, X } from 'lucide-react';

const SECONDS = 30;
const PROMPT_STARTERS = {
  Growth: 'I’m thankful for the growth I’ve seen…',
  Moment: 'I’m thankful for the moment when…',
  Surprise: 'I’m thankful RCA surprised us with…',
  People: 'I’m thankful for someone who…',
  Belonging: 'I’m thankful we felt like we belonged when…',
  Lesson: 'I’m thankful my child learned…',
};
const MIME_TYPES = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'];

function makePortraitStream(video, source, session) {
  if (video.videoWidth * 16 === video.videoHeight * 9) return source;
  const canvas = Object.assign(document.createElement('canvas'), { width: 540, height: 960 });
  if (!canvas.captureStream) throw new Error('Hold your phone upright and try opening the camera again.');
  const context = canvas.getContext('2d', { alpha: false });
  function paint() {
    const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    context.fillStyle = '#0b1528';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    session.frame = requestAnimationFrame(paint);
  }
  paint();
  session.canvasTrack = canvas.captureStream(30).getVideoTracks()[0];
  return new MediaStream([session.canvasTrack, ...source.getAudioTracks()]);
}

function beep(context, high = false) {
  if (!context || context.state !== 'running') return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.frequency.value = high ? 1040 : 720;
  gain.gain.setValueAtTime(.16, now);
  gain.gain.exponentialRampToValueAtTime(.001, now + .13);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + .14);
}

function stopSession(session) {
  clearInterval(session.timer);
  cancelAnimationFrame(session.frame);
  if (session.recorder?.state === 'recording') session.recorder.stop();
  session.canvasTrack?.stop();
  session.stream?.getTracks().forEach((track) => track.stop());
  void session.audio?.close().catch(() => {});
}

export default function CameraRecorder({ card, onClose, onRecorded }) {
  const dialog = useRef(null);
  const video = useRef(null);
  const session = useRef({});
  const [phase, setPhase] = useState('opening');
  const [remaining, setRemaining] = useState(SECONDS);
  const [count, setCount] = useState(3);
  const [tips, setTips] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const current = session.current;
    let disposed = false;
    dialog.current.showModal();
    async function open() {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
          throw new Error('This browser can’t record here. You can still upload a video from your camera roll.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        current.stream = stream;
        video.current.srcObject = stream;
        await video.current.play();
        if (!disposed) setPhase('ready');
      } catch (cause) {
        if (disposed) return;
        stopSession(current);
        setError(cause.name === 'NotAllowedError'
          ? 'Allow camera and microphone access, or upload a video from your camera roll.'
          : cause.name === 'NotFoundError' ? 'No camera or microphone was found. You can upload a video instead.' : cause.message);
        setPhase('error');
      }
    }
    void open();
    return () => { disposed = true; current.cancelled = true; stopSession(current); };
  }, []);

  function startRecording() {
    const current = session.current;
    clearInterval(current.timer);
    try {
      const stream = makePortraitStream(video.current, current.stream, current);
      const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 2_500_000 });
      current.recorder = recorder;
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        current.cancelled = true;
        stopSession(current);
        setError('Recording stopped unexpectedly. Try opening the camera again.');
        setPhase('error');
      };
      recorder.onstop = () => {
        if (current.cancelled) return;
        const type = (recorder.mimeType || chunks[0]?.type || 'video/webm').split(';')[0];
        const file = new File(chunks, `RCA-recording.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type });
        if (file.size) onRecorded(file);
        else {
          stopSession(current);
          setError('The camera didn’t save that take. Try recording again.');
          setPhase('error');
        }
      };
      recorder.start();
      const started = performance.now();
      setRemaining(SECONDS);
      setPhase('recording');
      current.timer = setInterval(() => {
        const left = Math.max(0, SECONDS - (performance.now() - started) / 1000);
        setRemaining(left);
        if (!left) finish();
      }, 80);
    } catch (cause) {
      stopSession(current);
      setError(cause.message || 'Recording couldn’t start. You can upload a video instead.');
      setPhase('error');
    }
  }

  function countdown() {
    const current = session.current;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) {
        current.audio = new Audio();
        void current.audio.resume().then(() => beep(current.audio)).catch(() => {});
      }
    } catch { /* The visual countdown still runs when audio is unavailable. */ }
    setTips(false);
    setCount(3);
    setPhase('countdown');
    let tick = 3;
    current.timer = setInterval(() => {
      tick--;
      if (tick > 0) {
        setCount(tick);
        beep(current.audio, tick === 1);
      } else startRecording();
    }, 1000);
  }

  function finish() {
    clearInterval(session.current.timer);
    if (session.current.recorder?.state !== 'recording') return;
    setPhase('saving');
    session.current.recorder.stop();
  }

  return <dialog ref={dialog} className="camera-dialog" aria-label="Record your video" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="camera-stage">
      <video ref={video} className="camera-feed" autoPlay muted playsInline/>
      <div className="camera-top">
        <span className="camera-prompt">{PROMPT_STARTERS[card[0]] ?? card[1]}</span>
        <button type="button" className="camera-close" onClick={onClose} aria-label="Close camera"><X size={22}/></button>
      </div>
      {phase === 'opening' && <p className="camera-message" role="status">Opening camera and microphone…</p>}
      {phase === 'ready' && tips && <div className="camera-tips">
        <button type="button" className="camera-close" onClick={() => setTips(false)} aria-label="Dismiss recording tips"><X size={20}/></button>
        <h2>Before you record</h2>
        <ul>
          <li><Sun size={20}/> Face a window or lamp.</li>
          <li><Mic size={20}/> Find a quiet spot.</li>
          <li><Smartphone size={20}/> Hold your phone upright at eye level.</li>
        </ul>
        <button type="button" className="button" onClick={() => setTips(false)}>Got it</button>
      </div>}
      {phase === 'countdown' && <div className="camera-count" role="status" aria-label={`Recording starts in ${count}`}>{count}</div>}
      {phase === 'error' && <p className="camera-message" role="alert">{error}</p>}
      {phase === 'saving' && <p className="camera-message" role="status">Opening your take…</p>}
      {((phase === 'ready' && !tips) || phase === 'recording') && <div className="camera-controls">
        {phase === 'recording' ? <>
          <div className="camera-timer"><span><i/> REC</span><span>{Math.ceil(remaining)}s left</span></div>
          <progress value={remaining} max={SECONDS} aria-label="Recording time remaining"/>
          <button type="button" className="button" onClick={finish}>Stop recording</button>
        </> : <>
          <button type="button" className="button" onClick={countdown}><Camera size={19}/> Start recording</button>
          <button type="button" className="camera-help" onClick={() => setTips(true)}>Recording tips</button>
        </>}
      </div>}
    </div>
  </dialog>;
}
