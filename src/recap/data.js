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

export async function uploadFile(file) {
  const isVideo = file.type.startsWith('video/');
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

  const name = `${CURRENT.slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(name, body, {
    contentType, upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
  return { url: data.publicUrl, kind: isVideo ? 'video' : 'image', ...dims };
}
