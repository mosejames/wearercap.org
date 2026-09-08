import { useEffect, useRef, useState } from 'react';
import { isVideo } from './videos.js';
import { MAX_BATCH } from './config.js';

/* ---------------------------------------------------------------------------
   Drag and drop.

   Desktop is where the big batches come from: somebody imports a card into a
   folder and wants to hand over the folder, not click through a picker. A drop
   carries three cases and all three end at one list of Files.

     dataTransfer.files          a plain multi-select drag
     webkitGetAsEntry() file     the same, through the entry API
     webkitGetAsEntry() dir      a dropped folder, read recursively

   Two things here are easy to get wrong and both fail quietly:

   1. dataTransfer.items is only alive during the drop event itself. Every
      entry has to be collected synchronously before anything is awaited, or
      Chrome hands back an empty list and folders look like they contained
      nothing.
   2. readEntries returns about a hundred entries per call and signals the end
      with an empty batch. Call it once and a folder of 300 photos silently
      becomes a folder of 100.
--------------------------------------------------------------------------- */

// Dotfiles are skipped, which is what keeps .DS_Store out of the vault.
export const droppable = (f) =>
  !!f && !f.name.startsWith('.') &&
  (/^image\//.test(f.type) || /\.(hei[cf]|jpe?g|png|webp|gif)$/i.test(f.name) || isVideo(f));

// Stop walking rather than crawl someone's whole Pictures library. The sheet
// keeps MAX_BATCH of whatever comes back and says so.
export const DROP_CAP = MAX_BATCH * 4;

const entryFile = (entry) => new Promise((res) => entry.file(res, () => res(null)));
const readDir = (reader) => new Promise((res) => reader.readEntries(res, () => res([])));

async function walkEntry(entry, out) {
  if (out.length >= DROP_CAP) return;
  if (entry.isFile) {
    const f = await entryFile(entry);
    if (droppable(f)) out.push(f);
    return;
  }
  if (!entry.isDirectory) return;
  const reader = entry.createReader();
  for (;;) {
    const batch = await readDir(reader);
    if (!batch.length) return;
    for (const e of batch) {
      await walkEntry(e, out);
      if (out.length >= DROP_CAP) return;
    }
  }
}

export async function filesFromDrop(dt) {
  const entries = [];
  for (const item of Array.from(dt?.items || [])) {
    if (item.kind !== 'file') continue;
    const e = item.webkitGetAsEntry?.();
    if (e) entries.push(e);
  }
  if (entries.length) {
    const out = [];
    for (const e of entries) await walkEntry(e, out);
    if (out.length) return out;
  }
  return Array.from(dt?.files || []).filter(droppable);
}

export const hasFiles = (e) => Array.from(e?.dataTransfer?.types || []).includes('Files');

// A photo dropped anywhere the app is not listening would otherwise replace
// the page with the image itself, which looks exactly like a crash.
export function useDropGuard() {
  useEffect(() => {
    const stop = (e) => { if (hasFiles(e)) e.preventDefault(); };
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => {
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
    };
  }, []);
}

// For an element that is its own target: the upload sheet. Enter and leave are
// counted so that dragging across a child does not flicker the highlight off.
// stopPropagation keeps the window-level target below from firing too, so the
// sheet wins whenever it is open.
export function useDropTarget(onFiles) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  return {
    over,
    handlers: {
      onDragEnter: (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); depth.current += 1; setOver(true); },
      onDragOver: (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; },
      onDragLeave: (e) => { if (!hasFiles(e)) return; e.stopPropagation(); depth.current -= 1; if (depth.current <= 0) { depth.current = 0; setOver(false); } },
      onDrop: async (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault(); e.stopPropagation();
        depth.current = 0; setOver(false);
        onFiles(await filesFromDrop(e.dataTransfer));
      },
    },
  };
}

/* For the event page, where the target has to be the whole window rather than
   the page element.

   The first version bound to the event's own div, and that div is only as tall
   as its contents. On an event with no photos yet it is a few hundred pixels,
   so a drop aimed at the empty space below it landed on nothing. Worse, the
   guard above swallows those drops, so a miss did nothing at all rather than
   navigating away: indistinguishable from broken.

   onFiles goes through a ref so that passing a fresh arrow function every
   render does not tear down and rebuild the listeners mid-drag, which loses
   the enter and leave count and leaves the overlay stuck on. */
export function useWindowDropTarget(onFiles, enabled = true) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const cb = useRef(onFiles);
  cb.current = onFiles;

  useEffect(() => {
    if (!enabled) { depth.current = 0; setOver(false); return undefined; }
    const enter = (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth.current += 1; setOver(true); };
    const over_ = (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    const leave = (e) => {
      if (!hasFiles(e)) return;
      depth.current -= 1;
      if (depth.current <= 0) { depth.current = 0; setOver(false); }
    };
    const drop = async (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0; setOver(false);
      cb.current(await filesFromDrop(e.dataTransfer));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over_);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over_);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [enabled]);

  return over;
}
