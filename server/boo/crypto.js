import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
function key() {
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  if (!secret) throw Error("Photo encryption is not configured.");
  return createHash("sha256")
    .update("rcap-little-boo-v1\0" + secret)
    .digest();
}
export function seal(bytes) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(bytes), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}
export function open(bytes) {
  const d = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  d.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([d.update(bytes.subarray(28)), d.final()]);
}
