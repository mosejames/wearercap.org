import sharp from 'sharp';
import {initialRegistry} from '../../src/trip-studio/model.js';
import {cleanDraft, saveDraft, problem} from './model.js';
import {readRegistry, writeRegistry} from './storage.js';
import {liveList,publishAction} from '../trip-engine/publish.js';
export async function authorize(req) {
  const authorization = req.headers?.authorization;
  if (!authorization?.startsWith('Bearer ') || authorization.length > 8192) throw problem('Sign in to Trip Studio.', 401);
  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const apikey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  // Explicit Trip Studio membership is independent of trip upload or export access.
  const allowed = (process.env.TRIP_STUDIO_ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!base || !apikey || !allowed.length) throw problem('Trip Studio administrator access is not configured.', 503);
  let response;
  try { response = await fetch(`${base}/auth/v1/user`, {headers:{apikey, Authorization:authorization}, signal:AbortSignal.timeout(5000)}); }
  catch { throw problem('Could not verify administrator access. Try again.', 503); }
  if (!response.ok) throw problem('Sign in again to continue.', 401);
  const user = await response.json();
  if (!user.email_confirmed_at || !allowed.includes(user.email?.toLowerCase())) throw problem('This account does not have Trip Studio access.', 403);
  return {email: user.email};
}
async function normalizeImage(data, logo) {
  if (!data) return '';
  try {
    const image = sharp(Buffer.from(data.split(',')[1], 'base64'), {limitInputPixels: 20000000, animated:false}).rotate().resize({width:logo ? 400 : 1400, height:logo ? 400 : 1000, fit:'inside', withoutEnlargement:true});
    const output = logo ? await image.png().toBuffer() : await image.jpeg({quality:80}).toBuffer();
    if (output.length > 500000) throw Error('too large');
    return `data:image/${logo ? 'png' : 'jpeg'};base64,${output.toString('base64')}`;
  } catch { throw problem('Could not prepare this image. Choose a smaller PNG, JPEG or WebP.'); }
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET','POST'].includes(req.method)) { res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Method not allowed.'}); }
  try {
    const me = await authorize(req);
    if (req.method === 'GET') {
      const {registry} = await readRegistry();
      return res.status(200).json({registry:{...(registry || initialRegistry()),liveTrips:await liveList(req)}, me});
    }
    let body = req.body;
    if (typeof body === 'string') { if (Buffer.byteLength(body) > 2500000) throw problem('Choose smaller branding images.', 413); try { body = JSON.parse(body); } catch { throw problem('Could not read the draft.'); } }
    if (!body || Buffer.byteLength(JSON.stringify(body)) > 2500000) throw problem('Choose smaller branding images.', 413);
    if(body.action==='discard-test'){const {discardTest}=await import('../trip-engine/discard-test.js');return res.status(200).json({registry:await discardTest(req,body),me});}
    if (['publish','phase','unpublish'].includes(body.action)) {
      const {registry}=await readRegistry();
      if(!registry)throw problem('Save this draft before launching it.',404);
      await publishAction(req,body,registry);
      return res.status(200).json({registry:{...registry,liveTrips:await liveList(req)},me});
    }
    if (body.action !== 'save') throw problem('Unknown dashboard action.',403);
    const draft = cleanDraft(body.draft);
    [draft.logo, draft.hero] = await Promise.all([normalizeImage(draft.logo, true), normalizeImage(draft.hero, false)]);
    const {registry, etag} = await readRegistry();
    const next = saveDraft(registry || initialRegistry(), draft, body.revision);
    await writeRegistry(next, etag);
    return res.status(200).json({registry:{...next,liveTrips:await liveList(req)}, me});
  } catch(e) { return res.status(e.status || 503).json({error:e.status ? e.message : 'Trip Studio is temporarily unavailable. Your unsaved changes remain on screen.'}); }
}
