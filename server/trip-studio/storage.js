import crypto from 'node:crypto';
import {AwsClient} from 'aws4fetch';
import {problem} from './model.js';
const PATH = '_private/trip-studio/v1/registry.enc';
function key() {
  const secret = process.env.TRIP_STUDIO_KEY || process.env.NYC_EXPORT_KEY;
  if (!/^[a-f0-9]{64}$/i.test(secret || '')) throw problem('Private draft storage needs its encryption key.', 503);
  return crypto.hkdfSync('sha256', Buffer.from(secret, 'hex'), Buffer.from('rcap-trip-studio-v1'), Buffer.from('private-drafts'), 32);
}
export function seal(value) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}
export function open(bytes) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
}
async function request(init = {}) {
  const {R2_ACCOUNT_ID: account, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey} = process.env;
  if (![account, bucket, accessKeyId, secretAccessKey].every(Boolean)) throw problem('Private draft storage is not configured.', 503);
  key();
  const aws = new AwsClient({accessKeyId, secretAccessKey, service: 's3', region: 'auto'});
  return aws.fetch(`https://${account}.r2.cloudflarestorage.com/${bucket}/${PATH}`, {...init, signal: AbortSignal.timeout(15000)});
}
export async function readRegistry() {
  const r = await request();
  if (r.status === 404) return {registry: null, etag: null};
  if (!r.ok) throw problem('Could not load saved drafts.', 503);
  const etag = r.headers.get('etag');
  if (!etag) throw problem('Draft storage did not return a version. Saving is unavailable.', 503);
  return {registry: open(Buffer.from(await r.arrayBuffer())), etag};
}
export async function writeRegistry(value, etag) {
  const body = seal(value);
  if (body.length > 3000000) throw problem('Draft storage is full. Remove large branding images.');
  const r = await request({method:'PUT', body, headers:{'Content-Type':'application/octet-stream', 'Cache-Control':'no-store', ...(etag ? {'If-Match':etag} : {'If-None-Match':'*'})}});
  if ([409, 412].includes(r.status)) throw problem('Another save arrived first. Reload saved drafts before trying again.', 409);
  if (!r.ok) throw problem('Could not save this draft. Your changes remain on screen.', 503);
}
