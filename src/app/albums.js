// Read the same public album records as the Capsule, without loading any photos.
// Revalidate every refresh; hidden, removed, and other-vault albums are excluded.
export function visibleAlbums(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => row.house === 'rcap' && row.hidden === false && /^[a-z0-9][a-z0-9-]*$/.test(row.slug))
    .map(row => ({id:`album-${row.slug}`, title:row.title, detail:'An album in the RCAP Capsule.', href:`/rcap-capsule/e/${row.slug}`, icon:'Images', color:'blue', group:'albums', date:row.starts_on, slug:row.slug}));
}
export async function fetchCapsuleAlbums(signal) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Album list unavailable');
  const response = await fetch(`${url}/rest/v1/vault_events?select=slug,title,house,starts_on,hidden&house=eq.rcap&hidden=eq.false&order=starts_on.desc`, {
    headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store',signal,
  });
  if (!response.ok) throw new Error('Album list unavailable');
  return visibleAlbums(await response.json());
}
