import React, { useState } from "react";
import { Download } from "lucide-react";
import { details, archiveUrl } from "./api.js";
export default function PdfDownloads({ requestId }) {
  const [busy, setBusy] = useState(false),
    [files, setFiles] = useState([]),
    [message, setMessage] = useState("");
  async function open(file) {
    window.location.assign(await archiveUrl(file.path));
  }
  async function download() {
    setBusy(true);
    setMessage("");
    try {
      const result = await details(requestId);
      const archive = result.notifications.find((n) => n.archive_files?.length);
      if (!archive) {
        setMessage(
          "Your PDF is still being prepared. Please try again shortly.",
        );
        return;
      }
      setFiles(archive.archive_files);
      if (archive.archive_files.length === 1)
        await open(archive.archive_files[0]);
    } catch {
      setMessage("Could not download the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ padding: "0 20px 16px" }}>
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={download}
      >
        <Download size={16} />
        {busy ? "Preparing download…" : "Download PDF"}
      </button>
      {files.length > 1 && (
        <div>
          <p>
            This request has {files.length} PDF parts. Download all parts for
            the complete record.
          </p>
          {files.map((file, i) => (
            <button
              key={file.path}
              type="button"
              className="text-button"
              onClick={async () => {
                try {
                  await open(file);
                } catch {
                  setMessage("Could not download this part. Please try again.");
                }
              }}
            >
              Download part {i + 1}
            </button>
          ))}
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
