import {guardUploads,galleryPhotos} from './london-dedupe/index.js';
import { AwsClient } from 'aws4fetch';
const VAULT = 'london-2028';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER = /^[0-9a-f]{64}$/;
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
export function r2Config() {
  return { account: process.env.R2_ACCOUNT_ID, key: process.env.R2_ACCESS_KEY_ID, secret: process.env.R2_SECRET_ACCESS_KEY, bucket: process.env.R2_BUCKET, publicBase: (process.env.R2_PUBLIC_BASE || '').replace(/\/+$/, '') };
}
export function keysFor(slug, id, ext, owner) {
  const base = `${VAULT}/${owner.slice(0, 8)}/${slug}/${id}`;
  return { orig: `${base}/orig.${ext}`, web: `${base}/web.jpg`, thumb: `${base}/thumb.jpg` };
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const r2 = r2Config();
  if (!Object.values(r2).every(Boolean)) return res.status(503).json({ error: 'Photo storage is temporarily unavailable. Please try again later.' });
  if (req.method === 'GET') return res.status(200).json({ mode: 'r2', publicBase: r2.publicBase });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!OWNER.test(body?.owner || '') || !UUID.test(body?.eventId || '') || !Array.isArray(body?.files) || !body.files.length || body.files.length > 40) return res.status(400).json({ error: 'Please choose your photos again.' });
  for (const f of body.files) {
    if (!UUID.test(f.id || '') || !Object.hasOwn(TYPES, f.ext) || TYPES[f.ext] !== f.contentType) return res.status(400).json({ error: 'This file type is not supported.' });
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return res.status(503).json({ error: 'The vault is temporarily unavailable.' });
  // Administrators can import Dropbox submissions without impersonating a
  // contributor. The existing vault passphrase authorizes this separate path.
  if (body.adminPass) {
    if (typeof body.adminPass !== 'string' || body.adminPass.length > 200) return res.status(403).json({error:'Could not authorize this import.'});
    try {
      const verified=await fetch(`${url}/rest/v1/rpc/m3_pass_ok`,{method:'POST',headers:{apikey:anon,Authorization:`Bearer ${anon}`,'Content-Type':'application/json'},body:JSON.stringify({p_vault:VAULT,p_pass:body.adminPass}),signal:AbortSignal.timeout(5000)});
      if(!verified.ok || await verified.json()!==true)return res.status(403).json({error:'Could not authorize this import.'});
    } catch {return res.status(503).json({error:'Could not authorize this import.'});}
  } else {
  const authorization=req.headers?.authorization || req.headers?.Authorization;
  if(!authorization?.startsWith('Bearer '))return res.status(401).json({error:'Please sign in to share.'});
  try{
    const verified=await fetch(`${url}/rest/v1/rpc/london_verified_owner`,{method:'POST',headers:{apikey:anon,Authorization:authorization,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
    if(!verified.ok || await verified.json()!==body.owner)return res.status(403).json({error:'Please sign in with the account sharing these photos.'});
  }catch{return res.status(503).json({error:'Could not verify your account. Please try again.'});}
  }
  let event;
  try {
    const response = await fetch(`${url}/rest/v1/m3_events?id=eq.${body.eventId}&vault=eq.${VAULT}&hidden=eq.false&select=slug,ongoing,starts_on`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Album lookup failed');
    [event] = await response.json();
  } catch { return res.status(503).json({ error: 'Could not check this album. Please try again.' }); }
  if (!event || event.slug !== body.eventSlug || !/^[a-z0-9-]{1,60}$/.test(event.slug)) return res.status(403).json({ error: 'Please choose an open London trip album.' });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (!event.ongoing && event.starts_on > today) return res.status(403).json({ error: 'This album is not open yet.' });
  if(!body.adminPass && body.files.some(f=>!f.sourceHash || f.contentType.startsWith('image/')&&!f.duplicateThumb)) return res.status(409).json({error:'Please refresh this page before sharing photos.'});
  const aws = new AwsClient({ accessKeyId: r2.key, secretAccessKey: r2.secret, service: 's3', region: 'auto' });
  async function sign(key, contentType) {
    const target = new URL(`https://${r2.account}.r2.cloudflarestorage.com/${r2.bucket}/${key}`);
    target.searchParams.set('X-Amz-Expires', '900');
    const signed = await aws.sign(new Request(target, { method: 'PUT', headers: { 'Content-Type': contentType } }), { aws: { signQuery: true } });
    return signed.url;
  }
  try {
    const hasChecks=body.files.some(f=>f.sourceHash||f.duplicateThumb);
    const duplicates=hasChecks?await guardUploads(body.files,await galleryPhotos(),body.owner):new Map();
    const items = await Promise.all(body.files.map(async (f) => {
      if(duplicates.get(f.id)?.duplicate)return duplicates.get(f.id);
      const keys = keysFor(event.slug, f.id, f.ext, body.owner);
      if (f.ext === 'm4v') keys.playback = keys.orig.replace('/orig.m4v', '/playback.mp4');
      const urls = { orig: await sign(keys.orig, f.contentType), web: await sign(keys.web, 'image/jpeg'), thumb: await sign(keys.thumb, 'image/jpeg') };
      if (keys.playback) urls.playback = await sign(keys.playback, 'video/mp4');
      return { id: f.id, keys, urls };
    }));
    return res.status(200).json({ mode: 'r2', publicBase: r2.publicBase, items });
  } catch (e) { return res.status(503).json({ error: e.message==='This photo is already being shared. Please try again shortly.'?e.message:'Could not prepare photo storage. Please try again.' }); }
}
