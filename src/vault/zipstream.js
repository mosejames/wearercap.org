// ---------------------------------------------------------------------------
// Streaming ZIP writer for "download this whole event".
//
// The Recap's zip.js builds the archive in memory, which is fine for a dozen
// selfies and not fine for four hundred originals. This one produces a
// ReadableStream: each file is fetched, CRC'd and written as it goes, so the
// browser only ever holds a few chunks at a time. On Chrome and Edge the
// stream goes straight to disk through the File System Access API; elsewhere
// it is collected into a Blob and handed to a normal download.
//
// Format notes, for whoever opens this next:
//   - STORE only. JPEGs do not compress; deflate would just burn CPU.
//   - Data descriptors (flag bit 3), because sizes and CRCs are not known
//     until the bytes have streamed past.
//   - Zip64 throughout, because a full-year archive of originals can pass
//     4GB and the format's 32-bit fields stop there. macOS Archive Utility,
//     Windows Explorer, 7-Zip, The Unarchiver and Python's zipfile all read
//     zip64 with descriptors.
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32Update(crc, bytes) {
  let c = crc ^ 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const y = Math.max(1980, d.getFullYear());
  const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() >> 1) & 31);
  const day = (((y - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { time, day };
}

class Buf {
  constructor(size) { this.v = new DataView(new ArrayBuffer(size)); this.o = 0; }
  u16(n) { this.v.setUint16(this.o, n, true); this.o += 2; return this; }
  u32(n) { this.v.setUint32(this.o, n >>> 0, true); this.o += 4; return this; }
  u64(n) { this.v.setBigUint64(this.o, BigInt(n), true); this.o += 8; return this; }
  bytes() { return new Uint8Array(this.v.buffer, 0, this.o); }
}

const enc = new TextEncoder();

// Dedupe names the way Finder would: "a.jpg", "a (2).jpg", "a (3).jpg".
export function uniqueNames() {
  const seen = new Map();
  return (name) => {
    const n = seen.get(name) || 0;
    seen.set(name, n + 1);
    if (n === 0) return name;
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(0, dot)} (${n + 1})${name.slice(dot)}` : `${name} (${n + 1})`;
  };
}

/**
 * @param {Array<{name: string, date?: Date|string|number, open: () => Promise<ReadableStream<Uint8Array>|Response|Blob>}>} entries
 * @param {{onProgress?: (info: {files: number, bytes: number}) => void}} [opts]
 * @returns {ReadableStream<Uint8Array>}
 */
export function zipStream(entries, opts = {}) {
  const gen = generate(entries, opts);
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await gen.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel() { gen.return(); },
  });
}

async function* streamOf(src) {
  if (src instanceof Response) src = src.body;
  if (src instanceof Uint8Array) { yield src; return; }
  if (typeof src.getReader !== 'function') {
    if (typeof src.stream === 'function') src = src.stream();
    else { yield new Uint8Array(await src.arrayBuffer()); return; }
  }
  const reader = src.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value && value.length) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

async function* generate(entries, { onProgress } = {}) {
  const central = [];
  let offset = 0;
  let files = 0;
  let bytes = 0;
  const unique = uniqueNames();

  const emit = (chunk) => { offset += chunk.length; bytes += chunk.length; return chunk; };

  for (const entry of entries) {
    const name = enc.encode(unique(entry.name));
    const { time, day } = dosDateTime(entry.date);
    const localOffset = offset;

    // Local header. Sizes/CRC are 0 here and land in the descriptor; the
    // zip64 extra field (all zeros) tells readers the descriptor is 64-bit.
    const local = new Buf(30)
      .u32(0x04034b50).u16(45).u16(0x0808).u16(0).u16(time).u16(day)
      .u32(0).u32(0).u32(0).u16(name.length).u16(20);
    const localExtra = new Buf(20).u16(0x0001).u16(16).u64(0).u64(0);
    yield emit(local.bytes()); yield emit(name); yield emit(localExtra.bytes());

    let crc = 0;
    let size = 0;
    const src = await entry.open();
    for await (const chunk of streamOf(src)) {
      crc = crc32Update(crc, chunk);
      size += chunk.length;
      yield emit(chunk);
    }

    // Data descriptor, zip64 flavour (8-byte sizes).
    yield emit(new Buf(24).u32(0x08074b50).u32(crc).u64(size).u64(size).bytes());

    // Central directory entry, saved for the end.
    const cd = new Buf(46)
      .u32(0x02014b50).u16(45).u16(45).u16(0x0808).u16(0).u16(time).u16(day)
      .u32(crc).u32(0xffffffff).u32(0xffffffff).u16(name.length).u16(28)
      .u16(0).u16(0).u16(0).u32(0).u32(0xffffffff);
    const cdExtra = new Buf(28).u16(0x0001).u16(24).u64(size).u64(size).u64(localOffset);
    central.push(cd.bytes(), name, cdExtra.bytes());

    files++;
    if (onProgress) onProgress({ files, bytes });
  }

  const cdStart = offset;
  for (const c of central) yield emit(c);
  const cdSize = offset - cdStart;

  // Zip64 end of central directory record + locator + classic EOCD.
  const z64 = new Buf(56)
    .u32(0x06064b50).u64(44).u16(45).u16(45).u32(0).u32(0)
    .u64(files).u64(files).u64(cdSize).u64(cdStart);
  const z64Offset = offset;
  yield emit(z64.bytes());
  yield emit(new Buf(20).u32(0x07064b50).u32(0).u64(z64Offset).u32(1).bytes());
  yield emit(new Buf(22)
    .u32(0x06054b50).u16(0).u16(0).u16(0xffff).u16(0xffff)
    .u32(0xffffffff).u32(0xffffffff).u16(0).bytes());
  if (onProgress) onProgress({ files, bytes, done: true });
}

// Where the bytes go. Chrome/Edge desktop: straight to a file the person
// picks, no memory ceiling. Everything else: gather, then download.
export async function saveStream(stream, filename) {
  if (typeof window !== 'undefined' && window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
      });
      const writable = await handle.createWritable();
      await stream.pipeTo(writable);
      return 'file';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // Fall through to the blob path on any other failure.
    }
  }
  const blob = await new Response(stream, { headers: { 'Content-Type': 'application/zip' } }).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'blob';
}
