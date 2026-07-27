import { supabase } from '../carpool/supabaseClient.js';
import { CURRENT, FIRST_SUMMER_CLASS, UNSORTED } from './config.js';

const TABLE = 'recap_entries';
const BUCKET = 'recap-media';

const fromRow = (r) => ({
  id: r.id,
  round: r.event_slug,
  parentName: r.parent_name || '',
  child: r.child,
  relation: r.relation,
  gradClass: r.grad_class,
  house: r.house,
  word: r.word,
  story: r.story || '',
  prompt: r.prompt || '',
  media: Array.isArray(r.media) ? r.media : [],
  firstSummer: r.first_summer,
  hidden: r.hidden,
  createdAt: r.created_at,
});

// slug === null returns every round; otherwise just that one.
export async function listEntries(slug = null) {
  let q = supabase.from(TABLE).select('*');
  if (slug) q = q.eq('event_slug', slug);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function addEntry(form, media) {
  const gradClass = form.gradClass;
  const house = gradClass === FIRST_SUMMER_CLASS ? UNSORTED.id : form.house;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      event_slug: CURRENT.slug,
      parent_name: (form.parentName || '').trim(),
      child: form.child.trim(),
      relation: form.relation,
      grad_class: gradClass,
      house,
      word: form.word,
      story: (form.story || '').trim(),
      prompt: (form.story || '').trim() ? (form.prompt || '').trim() : '',
      media,
      first_summer: gradClass === FIRST_SUMMER_CLASS,
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function setHidden(id, hidden, passcode) {
  const { error } = await supabase.rpc('recap_set_hidden', {
    p_id: id, p_hidden: hidden, p_pass: passcode,
  });
  if (error) throw error;
}

async function compressImage(file, maxDim = 2400, quality = 0.85) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    bitmap.close?.();
    return { blob: blob || file, w, h };
  } catch {
    return { blob: file, w: null, h: null };
  }
}

// iOS Safari will not paint a frame from preload="metadata", so a video with no
// poster renders as an empty box on a phone. Grab a real frame at upload time and
// store it as the poster. Every branch resolves to null rather than throwing —
// a failed thumbnail must never cost a parent their upload.
function videoPoster(file) {
  return new Promise((resolve) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (value) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      resolve(value);
    };

    const draw = () => {
      try {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) return done(null);
        const scale = Math.min(1, 1280 / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => done(blob ? { blob, w, h } : null), 'image/jpeg', 0.8);
      } catch { done(null); }
    };

    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.onloadeddata = () => {
      // A frame at exactly 0 is often black; step just past the start.
      const t = Math.min(0.15, (video.duration || 1) / 4);
      if (video.currentTime === t) draw(); else { try { video.currentTime = t; } catch { draw(); } }
    };
    video.onseeked = draw;
    video.onerror = () => done(null);
    setTimeout(() => done(null), 8000); // never hang the upload
    video.src = url;
    // iOS sometimes needs the decoder nudged before it will hand over a frame.
    video.play?.().then(() => video.pause()).catch(() => {});
  });
}

// The recap-media bucket inherits the project's 50 MB ceiling. Images are
// compressed below it automatically; video is uploaded as-is, and iPhones shoot
// 4K by default, so a short clip can blow straight past it. Catch that here and
// say something a parent can act on instead of letting Storage reject it after
// a long upload on cell data.
const MAX_UPLOAD = 50 * 1024 * 1024;
// Round up, so a file that is over the limit never reads as equal to it.
const asMB = (bytes) => Math.max(1, Math.ceil(bytes / (1024 * 1024)));
const LIMIT_MB = Math.round(MAX_UPLOAD / (1024 * 1024));

export async function uploadFile(file) {
  const isVideo = file.type.startsWith('video/');

  if (isVideo && file.size > MAX_UPLOAD) {
    throw new Error(
      `That video is about ${asMB(file.size)} MB and the limit is ${LIMIT_MB} MB. ` +
      `Trim it in Photos (Edit, drag the ends in, Save as New Clip), or add a photo instead.`
    );
  }

  let body = file;
  let dims = { w: null, h: null };
  let ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  let contentType = file.type || 'application/octet-stream';

  if (!isVideo) {
    const c = await compressImage(file);
    body = c.blob;
    dims = { w: c.w, h: c.h };
    ext = 'jpg';
    contentType = 'image/jpeg';
  }

  if (body.size > MAX_UPLOAD) {
    throw new Error(
      `That file is about ${asMB(body.size)} MB and the limit is ${LIMIT_MB} MB. ` +
      `Try a smaller one.`
    );
  }

  const name = `${CURRENT.slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(name, body, {
    contentType, upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
  const out = { url: data.publicUrl, kind: isVideo ? 'video' : 'image', ...dims };

  // Poster frame for video. Capturing it also gives us the real dimensions, so
  // the masonry can reserve the right space instead of guessing.
  if (isVideo) {
    const shot = await videoPoster(file);
    if (shot) {
      const posterName = `${name.replace(/\.[^.]+$/, '')}-poster.jpg`;
      const { error: posterErr } = await supabase.storage.from(BUCKET)
        .upload(posterName, shot.blob, { contentType: 'image/jpeg', upsert: false });
      if (!posterErr) {
        out.poster = supabase.storage.from(BUCKET).getPublicUrl(posterName).data.publicUrl;
        out.w = shot.w; out.h = shot.h;
      }
    }
  }

  return out;
}
