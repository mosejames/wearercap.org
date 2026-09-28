import React, { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { sendVoice } from "./api.js";
export default function Voice({ survey }) {
  const [status, setStatus] = useState("idle"),
    [seconds, setSeconds] = useState(0),
    [clip, setClip] = useState(null),
    [permission, setPermission] = useState(""),
    [error, setError] = useState("");
  const recorder = useRef(),
    stream = useRef(),
    timer = useRef(),
    started = useRef(),
    canvas = useRef(),
    frame = useRef(),
    audioContext = useRef(),
    mounted = useRef(true),
    id = useRef(crypto.randomUUID());
  const cleanup = () => {
    clearInterval(timer.current);
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    audioContext.current?.close().catch(() => {});
  };
  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      window.removeEventListener("pagehide", stop);
    };
  }, []);
  useEffect(
    () => () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      cleanup();
    },
    [],
  );
  useEffect(
    () => () => {
      if (clip) URL.revokeObjectURL(clip.url);
    },
    [clip],
  );
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  async function record() {
    setError("");
    setStatus("requesting");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "This browser cannot record audio. You can still finish without a voice note.",
        );
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(
        media,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      const chunks = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        const duration = Math.min(
          30,
          (performance.now() - started.current) / 1000,
        );
        cleanup();
        if (!mounted.current) return;
        const blob = new Blob(chunks, { type: rec.mimeType });
        if (!blob.size || duration < 0.3) {
          setError("That recording was too short. Please try again.");
          setStatus("idle");
          return;
        }
        setClip({ blob, url: URL.createObjectURL(blob), duration });
        setSeconds(duration);
        setStatus("review");
      };
      rec.onerror = () => {
        cleanup();
        setError("Recording stopped unexpectedly. Please try again.");
        setStatus("idle");
      };
      started.current = performance.now();
      setSeconds(0);
      setClip(null);
      rec.start(200);
      setStatus("recording");
      timer.current = setInterval(() => {
        const elapsed = (performance.now() - started.current) / 1000;
        setSeconds(Math.min(30, elapsed));
        if (elapsed >= 30) stop();
      }, 100);
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ctx = new AC();
        audioContext.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(media).connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
          const el = canvas.current;
          if (el) {
            const c = el.getContext("2d");
            analyser.getByteTimeDomainData(samples);
            c.clearRect(0, 0, el.width, el.height);
            c.strokeStyle = "#f0b323";
            c.lineWidth = 3;
            c.beginPath();
            samples.forEach((v, i) => {
              const x = (i / samples.length) * el.width,
                y = (v / 255) * el.height;
              i ? c.lineTo(x, y) : c.moveTo(x, y);
            });
            c.stroke();
          }
          frame.current = requestAnimationFrame(draw);
        };
        draw();
      } catch {
        /* Timer and record state remain usable without a waveform. */
      }
    } catch (e) {
      cleanup();
      setStatus("idle");
      setError(
        e.name === "NotAllowedError"
          ? "Microphone access was declined. Allow it in your browser to record, or return to the Capsule."
          : e.message,
      );
    }
  }
  async function send() {
    if (!permission || !clip) return;
    setStatus("sending");
    setError("");
    try {
      await sendVoice(
        survey.id,
        id.current,
        clip.blob,
        permission,
        clip.duration,
      );
      setStatus("sent");
    } catch {
      setError(
        "Your voice note could not be sent. Your survey is already saved. Please try again.",
      );
      setStatus("review");
    }
  }
  if (status === "sent")
    return (
      <section className="card">
        <div className="seal">✓</div>
        <h2>Your voice matters.</h2>
        <p>Thanks for sharing a little of your night with us.</p>
        <p>
          {permission === "private"
            ? "Your note is private to RCAP leadership."
            : "Your note may be shared with the RCA school community as part of Voices of RCAP."}
        </p>
        <a className="primary" href={survey.gallery_url}>
          Back to the RCAP Capsule ↗
        </a>
      </section>
    );
  return (
    <section className="card voice">
      <div className="microphone-mark" aria-hidden="true">
        <Mic size={42} strokeWidth={1.6} />
      </div>
      <p className="eyebrow">Voices of RCAP · Optional</p>
      <h2>Say it in your own voice.</h2>
      <p>
        Share a favorite moment, encourage another parent, or tell us what could
        be better. Up to 30 seconds.
      </p>
      <p className="privacy">
        Your survey answers remain anonymous. Voice notes are optional. Your
        voice may be recognizable, so recordings should not be treated as
        anonymous. Audio is stored separately from your answers.
      </p>
      {(status === "idle" || status === "requesting") && (
        <p className="mic-permission">
          When you tap Record, your phone or browser may ask to use your
          microphone. Choose <strong>Allow</strong> to begin. You can listen
          back or start over before sending.
        </p>
      )}
      <div
        className={`recording-display ${status === "recording" ? "is-recording" : ""}`}
      >
        <canvas ref={canvas} width="600" height="90" aria-hidden="true" />
        <div className="timer" aria-live="off">
          {Math.floor(seconds).toString().padStart(2, "0")} / 30 sec
        </div>
      </div>
      {(status === "idle" || status === "requesting") && (
        <button
          className="record"
          disabled={status === "requesting"}
          onClick={record}
        >
          <Mic size={21} aria-hidden="true" />
          {status === "requesting"
            ? "Opening microphone…"
            : "Record a voice note"}
        </button>
      )}
      {status === "recording" && (
        <button className="record recording" onClick={stop}>
          <Square size={18} fill="currentColor" aria-hidden="true" /> Stop
          recording
        </button>
      )}
      {clip && (
        <>
          <audio controls src={clip.url} />
          <button
            disabled={status === "sending"}
            onClick={() => {
              setClip(null);
              setPermission("");
              setSeconds(0);
              id.current = crypto.randomUUID();
              setStatus("idle");
            }}
          >
            Record again
          </button>
          <fieldset disabled={status === "sending"}>
            <legend>How may we use your message?</legend>
            <label className="consent">
              <input
                type="radio"
                name="permission"
                value="private"
                checked={permission === "private"}
                onChange={() => setPermission("private")}
              />
              <span>
                <strong>Keep this private</strong>
                <small>Only RCAP leadership will hear this message.</small>
              </span>
            </label>
            <label className="consent">
              <input
                type="radio"
                name="permission"
                value="community"
                checked={permission === "community"}
                onChange={() => setPermission("community")}
              />
              <span>
                <strong>
                  You may share this with the RCA school community
                </strong>
                <small>
                  Your voice note may be featured as part of Voices of RCAP in
                  school communications, event recaps, the RCAP website, or
                  other RCA/RCAP community spaces.
                </small>
              </span>
            </label>
          </fieldset>
          <button
            className="primary"
            disabled={!permission || status === "sending"}
            onClick={send}
          >
            {status === "sending" ? "Sending…" : "Send voice note"}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <a className="text-link" href={survey.gallery_url}>
        Back to the RCAP Capsule ↗
      </a>
    </section>
  );
}
