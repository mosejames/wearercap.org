// Used by server-rendered link metadata and the matching token-gated OG image.
export async function describePrivateShare(token) {
  if (!/^[0-9a-f]{64}$/.test(String(token || ''))) return null;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const response = await fetch(`${url}/rest/v1/rpc/capsule_share`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_action: 'info' }), signal: AbortSignal.timeout(5000),
    });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}
export function sharePreviewCopy(info) {
  if (!info) return { title: 'Private Capsule Download', label: 'Link unavailable', detail: 'This private link may have expired or been disabled.', quality: 'Ask the capsule admin for a new link.', brand: 'RCAP Capsule' };
  const qualities = [info.allow_web_download && 'Web Quality', info.allow_full_download && 'Full Quality'].filter(Boolean);
  const count = Number(info.file_count || 0);
  return {
    title: info.title, brand: info.house === 'amistad' ? 'AMI Capsule' : 'RCAP Capsule',
    label: 'Private Capsule Download',
    detail: `${count} ${count === 1 ? 'photo or video' : 'photos and videos'}${qualities.length ? '. Download all without signing in.' : '. Downloads are currently disabled.'}`,
    quality: qualities.join(' + ') || 'Downloads disabled',
  };
}
