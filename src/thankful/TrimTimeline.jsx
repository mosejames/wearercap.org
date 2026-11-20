import React, { useEffect, useRef, useState } from 'react';

const FRAME_COUNT = 8;
function format(time) {
  const tenths = Math.round(time * 10);
  const seconds = (tenths % 600 / 10).toFixed(1).padStart(4, '0');
  return `${Math.floor(tenths / 600)}:${seconds}`;
}
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function TrimTimeline({ file, duration, start, end, time, limit, onTrim, onSeek }) {
  const strip = useRef(null);
  const drag = useRef(null);
  const [frames, setFrames] = useState([]);

  useEffect(() => {
    let active = true;
    let input;
    async function readFrames() {
      try {
        const { Input, BlobSource, ALL_FORMATS, CanvasSink } = await import('mediabunny');
        if (!active) return;
        input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
        const video = await input.getPrimaryVideoTrack();
        if (!video || !active) return;
        const sink = new CanvasSink(video, { width: 80, height: 120, fit: 'cover' });
        const stamps = Array.from({ length: FRAME_COUNT }, (_, index) => duration * (index + .5) / FRAME_COUNT);
        const thumbnails = [];
        for await (const sample of sink.canvasesAtTimestamps(stamps)) {
          if (!active) return;
          thumbnails.push(sample?.canvas.toDataURL('image/jpeg', .72));
        }
        if (active) setFrames(thumbnails);
      } catch { /* The timeline remains usable when thumbnails cannot be decoded. */ }
      finally { input?.dispose(); }
    }
    void readFrames();
    return () => { active = false; };
  }, [file, duration]);

  const minimum = Math.min(.2, duration);
  const bounds = {
    start: [Math.max(0, end - limit), end - minimum],
    end: [start + minimum, Math.min(duration, start + limit)],
  };
  const values = { start, end };
  const percent = (value) => `${value / duration * 100}%`;
  function apply(edge, value) {
    const next = clamp(value, ...bounds[edge]);
    onTrim(edge, next);
  }
  function move(event) {
    if (drag.current?.id !== event.pointerId) return;
    const { left, width } = strip.current.getBoundingClientRect();
    const value = (event.clientX - left - drag.current.offset) / width * duration;
    if (drag.current.edge) apply(drag.current.edge, value);
    else onSeek(clamp(value, start, end));
  }
  function begin(event, edge) {
    if (!event.isPrimary || event.button !== 0) return;
    event.stopPropagation();
    const { left, width } = strip.current.getBoundingClientRect();
    drag.current = {
      id: event.pointerId, edge,
      offset: edge ? event.clientX - (left + values[edge] / duration * width) : 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!edge) move(event);
  }
  function key(event, edge) {
    const step = event.shiftKey ? 1 : .1;
    const changes = { ArrowLeft: values[edge] - step, ArrowRight: values[edge] + step,
      ArrowDown: values[edge] - step, ArrowUp: values[edge] + step, Home: bounds[edge][0], End: bounds[edge][1] };
    if (!Object.hasOwn(changes, event.key)) return;
    event.preventDefault();
    apply(edge, changes[event.key]);
  }

  return <section className="timeline" aria-label="Trim your clip">
    <div className="timeline-heading"><strong>Trim your clip</strong><output>{format(end - start)} selected</output></div>
    <div className="filmstrip" ref={strip}
      onPointerDown={(event) => begin(event, null)} onPointerMove={move}
      onLostPointerCapture={() => { drag.current = null; }}>
      <div className="filmstrip-frames" aria-hidden="true">
        {Array.from({ length: FRAME_COUNT }, (_, index) => frames[index]
          ? <img key={index} src={frames[index]} alt="" draggable={false}/>
          : <span key={index}/>)}
      </div>
      <div className="trim-mask"><div className="trim-selection" style={{ left: percent(start), width: percent(end - start) }}/></div>
      <div className="trim-playhead" style={{ left: percent(clamp(time, start, end)) }}/>
      {['start', 'end'].map((edge) => <div key={edge} className={`trim-handle trim-${edge}`}
        style={{ left: percent(values[edge]) }} role="slider" tabIndex={0}
        aria-label={`Trim ${edge}`} aria-valuemin={bounds[edge][0]} aria-valuemax={bounds[edge][1]}
        aria-valuenow={values[edge]} aria-valuetext={format(values[edge])}
        onPointerDown={(event) => begin(event, edge)} onKeyDown={(event) => key(event, edge)}>
        <span aria-hidden="true"/>
      </div>)}
    </div>
    <div className="timeline-labels"><span>{format(start)}</span><span>Drag either end to trim</span><span>{format(end)}</span></div>
  </section>;
}
