// Renders PDF receipts to canvases with pdf.js, loaded only when a PDF is shown.
// The legacy build keeps older iPhones working.
let pdfjs;
async function lib() {
  if (!pdfjs) {
    const [mod, worker] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
    ]);
    mod.GlobalWorkerOptions.workerSrc = worker.default;
    pdfjs = mod;
  }
  return pdfjs;
}

export async function openPdf(url) {
  const { getDocument } = await lib();
  return getDocument({ url }).promise;
}

// Draw one page into `canvas`, scaled to `cssWidth` CSS pixels wide.
export async function drawPage(doc, number, canvas, cssWidth) {
  const page = await doc.getPage(number);
  const base = page.getViewport({ scale: 1 });
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport })
    .promise;
}
