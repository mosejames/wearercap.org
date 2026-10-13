import crypto from "node:crypto";
export const ROOT = "/RCA 2028 Trip Videos/From Their Stories/Originals";
export const END = Date.parse("2026-10-19T03:59:59.999Z");
export const VAULT = "london-2028";
export const TOPIC = "london-instagram-import";
export function mediaPath(path) {
  const prefix = ROOT.toLowerCase() + "/";
  const p = String(path || "").normalize("NFC");
  if (!p.toLowerCase().startsWith(prefix)) return null;
  const parts = p.slice(prefix.length).split("/");
  if (
    parts.length !== 2 ||
    !/^\w[\w.]{0,29}$/.test(parts[0]) ||
    !/^.+\.(jpg|jpeg|mp4)$/i.test(parts[1])
  )
    return null;
  return {
    path: p,
    account: parts[0],
    kind: /\.mp4$/i.test(p) ? "video" : "photo",
  };
}
export function idFor(path, hash) {
  const ns = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");
  const d = crypto
    .createHash("sha1")
    .update(ns)
    .update("london-dropbox:" + path.toLowerCase() + ":" + hash)
    .digest();
  d[6] = (d[6] & 15) | 80;
  d[8] = (d[8] & 63) | 128;
  const h = d.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
export const sha256 = (data) =>
  crypto.createHash("sha256").update(data).digest("hex");
export function dropboxHash(bytes) {
  const blocks = [];
  for (let i = 0; i < bytes.length; i += 4194304)
    blocks.push(
      crypto
        .createHash("sha256")
        .update(bytes.subarray(i, i + 4194304))
        .digest(),
    );
  return sha256(Buffer.concat(blocks));
}
export function metadataFor(meta, path) {
  const parsed = mediaPath(path);
  if (
    !parsed ||
    !meta?.media_pk ||
    String(meta.account).toLowerCase() !== parsed.account.toLowerCase() ||
    !Number.isFinite(Date.parse(meta.taken_at))
  )
    throw Error("Invalid Instagram sidecar");
  return {
    ...parsed,
    account: meta.account,
    mediaId: String(meta.media_pk),
    takenAt: new Date(meta.taken_at).toISOString(),
    credit: "Shared on Instagram by @" + meta.account,
  };
}
export function verifySignature(raw, header, secret) {
  if (!secret || !/^([a-f0-9]{64})$/i.test(header || "")) return false;
  return crypto.timingSafeEqual(
    crypto.createHmac("sha256", secret).update(raw).digest(),
    Buffer.from(header, "hex"),
  );
}
export function fingerprintMatches(a, b) {
  return (
    a &&
    b &&
    a.length === b.length &&
    Math.sqrt(a.reduce((sum, n, i) => sum + (n - b[i]) ** 2, 0) / a.length) < 4
  );
}
