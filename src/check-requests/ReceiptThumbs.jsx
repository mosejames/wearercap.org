import React, { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { receiptPreviewUrls } from "./api.js";

const isPdf = (path) => /\.pdf$/i.test(path);

// Receipt thumbnails. Each one is a real link, so it opens on iPhone too.
export default function ReceiptThumbs({ receipts, limit, labels = false }) {
  const [urls, setUrls] = useState({}),
    [failed, setFailed] = useState(false);
  const shown = limit ? receipts.slice(0, limit) : receipts;
  const key = shown.map((r) => r.path).join("|");
  useEffect(() => {
    let live = true;
    setFailed(false);
    receiptPreviewUrls(shown.map((r) => r.path))
      .then((u) => live && setUrls(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [key]);
  if (!receipts.length) return null;
  const extra = receipts.length - shown.length;
  return (
    <div className="receipt-thumbs">
      {shown.map((r) => {
        const url = urls[r.path];
        return (
          <a
            key={r.path}
            className={"receipt-thumb" + (labels ? " labeled" : "")}
            href={url || undefined}
            target="_blank"
            rel="noopener"
            aria-label={`Open receipt ${r.name}`}
            title={r.name}
          >
            <span className="receipt-thumb-frame">
              {isPdf(r.path) ? (
                <span className="receipt-thumb-pdf">
                  <FileText size={22} />
                  PDF
                </span>
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
      {extra > 0 && <span className="receipt-thumb-more">+{extra}</span>}
      {failed && (
        <p className="muted" role="status">
          Receipt previews could not load. Refresh to try again.
        </p>
      )}
    </div>
  );
}
