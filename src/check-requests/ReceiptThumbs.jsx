import React, { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { receiptPreviewUrls } from "./api.js";
import ReceiptLightbox, { isPdf } from "./ReceiptLightbox.jsx";
import { openPdf, drawPage } from "./pdfPreview.js";

// First page of a PDF receipt, drawn small. Falls back to a PDF tile.
function PdfThumb({ url }) {
  const canvas = useRef(null),
    [ok, setOk] = useState(false);
  useEffect(() => {
    if (!url) return;
    let live = true,
      doc;
    openPdf(url)
      .then(async (d) => {
        doc = d;
        if (!live || !canvas.current) return;
        await drawPage(d, 1, canvas.current, 120);
        if (live) setOk(true);
      })
      .catch(() => {});
    return () => {
      live = false;
      doc?.destroy();
    };
  }, [url]);
  return (
    <>
      <canvas ref={canvas} hidden={!ok} className="receipt-thumb-canvas" />
      {!ok && (
        <span className="receipt-thumb-pdf">
          <FileText size={22} />
          PDF
        </span>
      )}
    </>
  );
}

// Receipt thumbnails. Tap one to see it full size in a lightbox.
export default function ReceiptThumbs({ receipts, limit, labels = false }) {
  const [urls, setUrls] = useState({}),
    [failed, setFailed] = useState(false),
    [open, setOpen] = useState(null);
  const shown = limit ? receipts.slice(0, limit) : receipts;
  const key = receipts.map((r) => r.path).join("|");
  useEffect(() => {
    let live = true;
    setFailed(false);
    receiptPreviewUrls(receipts.map((r) => r.path))
      .then((u) => live && setUrls(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [key]);
  if (!receipts.length) return null;
  const extra = receipts.length - shown.length;
  const items = receipts.map((r) => ({ ...r, url: urls[r.path] }));
  return (
    <div className="receipt-thumbs">
      {shown.map((r, i) => {
        const url = urls[r.path];
        return (
          <a
            key={r.path}
            className={"receipt-thumb" + (labels ? " labeled" : "")}
            href={url || undefined}
            target="_blank"
            rel="noopener"
            aria-label={`View receipt ${r.name}`}
            title={r.name}
            onClick={(e) => {
              e.preventDefault();
              setOpen(i);
            }}
          >
            <span className="receipt-thumb-frame">
              {isPdf(r.path) ? (
                <PdfThumb url={url} />
              ) : url ? (
                <img src={url} alt="" loading="lazy" />
              ) : (
                <span className="receipt-thumb-wait" />
              )}
            </span>
            {labels && <span className="receipt-thumb-name">{r.name}</span>}
          </a>
        );
      })}
      {extra > 0 && (
        <button
          type="button"
          className="receipt-thumb-more"
          onClick={() => setOpen(shown.length)}
        >
          +{extra}
        </button>
      )}
      {failed && (
        <p className="muted" role="status">
          Receipt previews could not load. Refresh to try again.
        </p>
      )}
      {open !== null && (
        <ReceiptLightbox
          items={items}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
