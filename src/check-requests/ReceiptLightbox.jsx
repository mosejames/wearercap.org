import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X, ExternalLink } from "lucide-react";
import { openPdf, drawPage } from "./pdfPreview.js";

export const isPdf = (path) => /\.pdf$/i.test(path);

function PdfPages({ url, name }) {
  const box = useRef(null),
    [pages, setPages] = useState(0),
    [state, setState] = useState("loading");
  useEffect(() => {
    let live = true,
      doc;
    setState("loading");
    setPages(0);
    openPdf(url)
      .then(async (d) => {
        doc = d;
        if (!live) return;
        setPages(d.numPages);
        await new Promise((r) => requestAnimationFrame(r));
        const width = Math.min(box.current?.clientWidth || 800, 900);
        const canvases = box.current?.querySelectorAll("canvas") || [];
        for (let i = 0; i < canvases.length && live; i++)
          await drawPage(d, i + 1, canvases[i], width);
        if (live) setState("ready");
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
      doc?.destroy();
    };
  }, [url]);
  return (
    <div className="lightbox-pdf" ref={box}>
      {state === "loading" && <p className="lightbox-status">Loading {name}…</p>}
      {state === "error" && (
        <p className="lightbox-status">
          This PDF could not be previewed. Use Open original above.
        </p>
      )}
      {Array.from({ length: pages }, (_, i) => (
        <canvas key={i} aria-label={`${name}, page ${i + 1} of ${pages}`} />
      ))}
    </div>
  );
}

// Full-screen receipt viewer. Tap outside, press Escape, or tap X to close.
export default function ReceiptLightbox({ items, index, onIndex, onClose }) {
  const item = items[index];
  const closeRef = useRef(null);
  const many = items.length > 1;
  const go = (step) => onIndex((index + step + items.length) % items.length);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (many && e.key === "ArrowRight") go(1);
      if (many && e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  });
  useEffect(() => closeRef.current?.focus(), []);
  if (!item) return null;
  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Receipt: ${item.name}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="lightbox-bar">
        <div className="lightbox-title">
          <strong>{item.name}</strong>
          {many && (
            <span>
              {index + 1} of {items.length}
            </span>
          )}
        </div>
        {item.url && (
          <a className="lightbox-link" href={item.url} target="_blank" rel="noopener">
            <ExternalLink size={16} /> Open original
          </a>
        )}
        <button
          ref={closeRef}
          type="button"
          className="lightbox-close"
          aria-label="Close receipt"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      <div
        className="lightbox-stage"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {!item.url ? (
          <p className="lightbox-status">Loading…</p>
        ) : isPdf(item.path) ? (
          <PdfPages key={item.path} url={item.url} name={item.name} />
        ) : (
          <img className="lightbox-img" src={item.url} alt={item.name} />
        )}
      </div>
      {many && (
        <>
          <button
            type="button"
            className="lightbox-nav prev"
            aria-label="Previous receipt"
            onClick={() => go(-1)}
          >
            <ArrowLeft size={22} />
          </button>
          <button
            type="button"
            className="lightbox-nav next"
            aria-label="Next receipt"
            onClick={() => go(1)}
          >
            <ArrowRight size={22} />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
