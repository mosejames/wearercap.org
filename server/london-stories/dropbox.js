import { ROOT, dropboxHash } from "./core.js";
let cached;
export async function dropboxToken() {
  if (cached?.until > Date.now() + 60000) return cached.token;
  const r = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.DROPBOX_LONDON_REFRESH_TOKEN || "",
      client_id: process.env.DROPBOX_LONDON_APP_KEY || "",
      client_secret: process.env.DROPBOX_LONDON_APP_SECRET || "",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Error("Dropbox authorization failed: " + r.status);
  const j = await r.json();
  cached = { token: j.access_token, until: Date.now() + j.expires_in * 1000 };
  return cached.token;
}
export async function dbx(route, body) {
  const r = await fetch("https://api.dropboxapi.com/2/" + route, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + (await dropboxToken()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) {
    const e = new Error("Dropbox " + route + " failed: " + r.status);
    e.reset = r.status === 409 && (await r.text()).includes("reset");
    throw e;
  }
  return r.json();
}
export async function download(path, maxBytes = 500 * 1024 * 1024) {
  const r = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + (await dropboxToken()),
      "Dropbox-API-Arg": JSON.stringify({ path }).replace(
        /[\u007f-\uffff]/g,
        (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
      ),
    },
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw Error("Dropbox download failed: " + r.status);
  const meta = JSON.parse(r.headers.get("dropbox-api-result"));
  if (meta.size > maxBytes) throw Error("Source exceeds import size limit");
  const chunks = [];
  let size = 0;
  for await (const chunk of r.body) {
    size += chunk.length;
    if (size > maxBytes) throw Error("Source exceeds import size limit");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (size !== meta.size || dropboxHash(bytes) !== meta.content_hash)
    throw Error("Dropbox download integrity check failed");
  return { bytes, meta };
}
export async function listChanges(cursor) {
  return cursor
    ? dbx("files/list_folder/continue", { cursor })
    : dbx("files/list_folder", {
        path: ROOT,
        recursive: true,
        include_deleted: false,
        limit: 2000,
      });
}
