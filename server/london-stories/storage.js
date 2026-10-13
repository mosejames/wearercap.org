import crypto from "node:crypto";
import { AwsClient } from "aws4fetch";
import { r2Config } from "../london-sign.js";
const PREFIX = "_automation/london-stories/";
function encryptionKey() {
  const k = Buffer.from(process.env.LONDON_IMPORT_STATE_KEY || "", "hex");
  if (k.length !== 32) throw Error("Importer state key missing");
  return k;
}
export function encrypt(value) {
  const iv = crypto.randomBytes(12),
    c = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const bytes = Buffer.concat([c.update(JSON.stringify(value)), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), bytes]);
}
export function decrypt(bytes) {
  const d = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    bytes.subarray(0, 12),
  );
  d.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([d.update(bytes.subarray(28)), d.final()]).toString(),
  );
}
export async function objectRequest(key, init = {}) {
  const r = r2Config();
  const aws = new AwsClient({
    accessKeyId: r.key,
    secretAccessKey: r.secret,
    service: "s3",
    region: "auto",
  });
  return aws.fetch(
    `https://${r.account}.r2.cloudflarestorage.com/${r.bucket}/${key}`,
    { ...init, signal: AbortSignal.timeout(30000) },
  );
}
export async function readState(name) {
  const r = await objectRequest(PREFIX + name);
  if (r.status === 404) return { value: null, etag: null };
  if (!r.ok) throw Error("State read failed: " + r.status);
  return {
    value: decrypt(Buffer.from(await r.arrayBuffer())),
    etag: r.headers.get("etag"),
  };
}
export async function writeState(name, value, etag) {
  const headers = {
    "Content-Type": "application/octet-stream",
    "Cache-Control": "no-store",
    ...(etag ? { "If-Match": etag } : { "If-None-Match": "*" }),
  };
  const r = await objectRequest(PREFIX + name, {
    method: "PUT",
    headers,
    body: encrypt(value),
  });
  if (r.status === 412 || r.status === 409)
    throw Error("Concurrent importer state update");
  if (!r.ok) throw Error("State write failed: " + r.status);
  return r.headers.get("etag");
}
export async function withImportLock(work) {
  const current = await readState("lease");
  if (current.value?.until > Date.now())
    throw Error("Another import is active");
  const holder = crypto.randomUUID();
  let etag = await writeState(
    "lease",
    { holder, until: Date.now() + 600000 },
    current.etag,
  );
  try {
    return await work();
  } finally {
    await writeState("lease", { holder, until: 0 }, etag);
  }
}
