import { QueueClient } from "@vercel/queue";
import {
  ROOT,
  END,
  VAULT,
  TOPIC,
  mediaPath,
  metadataFor,
  idFor,
  sha256,
  fingerprintMatches,
} from "./core.js";
import { listChanges, dbx, download } from "./dropbox.js";
import {
  readState,
  writeState,
  withImportLock,
  objectRequest,
  decrypt,
} from "./storage.js";
import { contributor, rest } from "./contributor.js";
import { renditions, fingerprint } from "./renditions.js";
import seed from "./seed.json" with { type: "json" };
const queue = new QueueClient({ region: "iad1" });
export async function scan(full = false) {
  await withImportLock(async () => {
    const ledger = await readState("ledger");
    if (!ledger.value) {
      await contributor();
      await writeState(
        "ledger",
        decrypt(Buffer.from(seed.encrypted, "base64")),
        ledger.etag,
      );
    }
  });
  const current = await readState("cursor");
  let cursor = full ? null : current.value?.cursor;
  let page;
  try {
    page = await listChanges(cursor);
  } catch (e) {
    if (!e.reset) throw e;
    page = await listChanges(null);
  }
  const candidates = new Map();
  while (true) {
    for (const e of page.entries) {
      if (e[".tag"] !== "file") continue;
      let p = e.path_display;
      if (p?.endsWith(".json")) p = p.slice(0, -5);
      const parsed = mediaPath(p);
      if (parsed)
        candidates.set(p.toLowerCase(), {
          path: p,
          changed: e.server_modified,
        });
    }
    cursor = page.cursor;
    if (!page.has_more) break;
    page = await listChanges(cursor);
  }
  // Enqueue before checkpointing. A crash may redeliver, but cannot lose an item.
  for (const e of [...candidates.values()].sort((a, b) =>
    String(b.changed).localeCompare(String(a.changed)),
  ))
    await queue.send(
      TOPIC,
      { type: "media", path: e.path },
      { retentionSeconds: 604800 },
    );
  await writeState(
    "cursor",
    {
      cursor,
      checkedAt: new Date().toISOString(),
      candidates: candidates.size,
    },
    current.etag,
  );
  console.log("London stories scan", { candidates: candidates.size });
  return candidates.size;
}
export async function importMedia(path) {
  if (!mediaPath(path)) throw Error("Media outside London source folder");
  const tombstones = await readState("ledger");
  if (tombstones.value?.removedTestPaths?.includes(path.toLowerCase()))
    return { skipped: "removed-test" };
  const sidecarFirst = await download(path + ".json", 1024 * 1024);
  const sourceMeta = metadataFor(
    JSON.parse(sidecarFirst.bytes.toString()),
    path,
  );
  const known = await readState("ledger");
  const already = known.value?.items.find(
    (x) => x.mediaId === sourceMeta.mediaId,
  );
  if (already) return { duplicate: true, id: already.id };
  return withImportLock(async () => {
    const [media, sidecar] = await Promise.all([
      download(path),
      download(path + ".json", 1024 * 1024),
    ]);
    const meta = metadataFor(JSON.parse(sidecar.bytes.toString()), path);
    if (Date.parse(meta.takenAt) > END) return { skipped: "after-trip" };
    const sourceId = idFor(path, media.meta.content_hash),
      hash = sha256(media.bytes);
    const current = await readState("ledger");
    if (!current.value)
      throw Error("Import ledger must be seeded before enabling imports");
    const ledger = current.value;
    const match = ledger.items.find(
      (x) =>
        x.sourceId === sourceId ||
        x.mediaId === meta.mediaId ||
        x.hash === hash,
    );
    if (match) return { duplicate: true, id: match.id };
    const fp = meta.kind === "photo" ? await fingerprint(media.bytes) : null;
    const visual = fp && ledger.items.find((x) => fingerprintMatches(x.fp, fp));
    if (visual) {
      ledger.items.push({
        sourceId,
        mediaId: meta.mediaId,
        hash,
        id: visual.id,
        duplicate: true,
      });
      await writeState("ledger", ledger, current.etag);
      return { duplicate: true, id: visual.id };
    }
    const actor = await contributor();
    const photos = await rest("rpc/m3_list_photos", actor.token, {
      method: "POST",
      body: JSON.stringify({
        p_token: actor.sharingToken,
        p_vault: VAULT,
        p_mode: "recent",
        p_limit: 5000,
      }),
    });
    if (photos.some((x) => x.photo.id === sourceId)) {
      ledger.items.push({
        sourceId,
        mediaId: meta.mediaId,
        hash,
        fp,
        id: sourceId,
      });
      await writeState("ledger", ledger, current.etag);
      return { duplicate: true, id: sourceId };
    }
    const events = await rest(
      "m3_events?vault=eq.london-2028&slug=eq.the-whole-adventure&hidden=eq.false&select=id,slug",
      actor.token,
    );
    const event = events[0];
    if (!event) throw Error("London album not available");
    const r = await renditions(media.bytes, meta.kind);
    const ext = meta.kind === "video" ? "m4v" : "jpg";
    const sign = await fetch("https://wearercap.org/api/london-sign", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + actor.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        owner: actor.owner,
        eventId: event.id,
        eventSlug: event.slug,
        files: [
          {
            id: sourceId,
            ext,
            contentType: meta.kind === "video" ? "video/mp4" : "image/jpeg",
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!sign.ok) throw Error("London signing failed: " + sign.status);
    const signed = await sign.json(),
      item = signed.items?.[0];
    if (signed.mode !== "r2" || !item?.urls)
      throw Error("Invalid London signing response");
    const parts = [
      ["orig", media.bytes, meta.kind === "video" ? "video/mp4" : "image/jpeg"],
      ["web", r.web, "image/jpeg"],
      ["thumb", r.thumb, "image/jpeg"],
    ];
    if (r.playback) parts.push(["playback", r.playback, "video/mp4"]);
    for (const [part, bytes, type] of parts) {
      if (!item.urls[part]) throw Error("Playback signing unavailable");
      const put = await fetch(item.urls[part], {
        method: "PUT",
        headers: { "Content-Type": type },
        body: bytes,
        signal: AbortSignal.timeout(60000),
      });
      if (!put.ok) throw Error("Media upload failed: " + put.status);
      const check = await objectRequest(item.keys[part]);
      if (
        !check.ok ||
        sha256(Buffer.from(await check.arrayBuffer())) !== sha256(bytes)
      )
        throw Error("R2 integrity check failed");
    }
    const row = {
      id: sourceId,
      event_id: event.id,
      vault: VAULT,
      owner: actor.owner,
      uploader_name: meta.credit,
      kind: meta.kind,
      storage: "r2",
      key: item.keys.orig,
      web_key: item.keys.web,
      thumb_key: item.keys.thumb,
      width: r.width,
      height: r.height,
      bytes: media.bytes.length,
      duration_s: r.duration,
      content_type: meta.kind === "video" ? "video/mp4" : "image/jpeg",
      taken_at: meta.takenAt,
      caption: "",
      scholar_name: "",
    };
    try {
      await rest("m3_photos", actor.token, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(row),
      });
    } catch (e) {
      if (e.status !== 409) throw e;
    }
    ledger.items.push({
      sourceId,
      mediaId: meta.mediaId,
      hash,
      fp,
      id: sourceId,
    });
    ledger.lastImportAt = new Date().toISOString();
    await writeState("ledger", ledger, current.etag);
    console.log("London stories imported", {
      id: sourceId,
      kind: meta.kind,
      account: meta.account,
    });
    return { imported: true, id: sourceId };
  });
}
// Operator-only cleanup is limited to synthetic verification files. Normal
// ingestion never deletes Dropbox files, gallery rows, or production media.
async function cleanupTests(ids, paths) {
  return withImportLock(async () => {
    const current = await readState("ledger");
    const actor = await contributor();
    const allowed = new Set();
    for (const path of paths || []) {
      if (
        !mediaPath(path) ||
        !/\/vault-import-(?:test-|redelivery-test\.|live-check\.)/.test(path)
      )
        throw Error("Not a test path");
      const [file, sidecar] = await Promise.all([
        dbx("files/get_metadata", { path }),
        download(path + ".json", 1024 * 1024),
      ]);
      const meta = metadataFor(JSON.parse(sidecar.bytes.toString()), path);
      if (!/^automation-(test|live-check)-/.test(meta.mediaId))
        throw Error("Not synthetic test media");
      allowed.add(idFor(path, file.content_hash));
    }
    for (const id of ids || []) {
      if (!allowed.has(id))
        throw Error("Cleanup is limited to verified synthetic tests");
      for (const part of ["orig.jpg", "web.jpg", "thumb.jpg"]) {
        const key = `london-2028/${actor.owner.slice(0, 8)}/the-whole-adventure/${id}/${part}`;
        const response = await objectRequest(key, { method: "DELETE" });
        if (!response.ok) throw Error("Test rendition cleanup failed");
      }
    }
    const removed = (paths || []).filter(
      (p) =>
        mediaPath(p) &&
        /\/vault-import-(?:test-|redelivery-test\.|live-check\.)/.test(p),
    );
    current.value.removedTestPaths = [
      ...new Set([
        ...(current.value.removedTestPaths || []),
        ...removed.map((p) => p.toLowerCase()),
      ]),
    ];
    await writeState("ledger", current.value, current.etag);
    return { cleanedTests: ids.length };
  });
}
export async function processMessage(message) {
  try {
    let result;
    if (message.type === "scan") result = await scan(message.full === true);
    else if (message.type === "media") result = await importMedia(message.path);
    else if (message.type === "cleanup-tests")
      result = await cleanupTests(message.ids, message.paths);
    else throw Error("Unknown London import job");
    const status = await readState("status");
    await writeState(
      "status",
      { ok: true, at: new Date().toISOString(), type: message.type, result },
      status.etag,
    );
    return result;
  } catch (error) {
    try {
      const status = await readState("status");
      await writeState(
        "status",
        {
          ok: false,
          at: new Date().toISOString(),
          type: message.type,
          error: error.message,
        },
        status.etag,
      );
    } catch {}
    throw error;
  }
}
