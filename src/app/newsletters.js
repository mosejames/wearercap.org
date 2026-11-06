// Reuse the archive's published-only RPC. Never fetch editor data or draft issues.
export function newsletterIssues(rows) {
  if(!Array.isArray(rows)) throw new Error('Invalid newsletter archive');
  return rows.filter(row=>/^[a-z0-9][a-z0-9-]{1,70}$/.test(row?.slug)&&/^\d{4}-\d{2}-\d{2}$/.test(row?.issue_date)&&Number.isFinite(Date.parse(row.issue_date+'T12:00:00Z')))
    .map(row=>({slug:row.slug,href:'/newsletter/'+row.slug,date:row.issue_date,
      dateLabel:new Date(row.issue_date+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}),
      title:String(row.headline||row.title||'RCAP newsletter').replace(/<[^>]*>/g,'').trim()}))
    .sort((a,b)=>b.date.localeCompare(a.date));
}
export async function fetchNewsletterIssues(signal) {
  const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
  if(!url||!key) throw new Error('Newsletter archive unavailable');
  const response=await fetch(`${url}/rest/v1/rpc/rcap_newsletter_archive`,{
    method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({p_slug:null}),cache:'no-store',signal,
  });
  if(!response.ok) throw new Error('Newsletter archive unavailable');
  return newsletterIssues(await response.json());
}
