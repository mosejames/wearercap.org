// Supabase requests are awaitable builders, not native Promises with .catch().
export async function attachReactionCounts(photos,client){
 const grouped=new Map(),chunks=[];
 for(let i=0;i<photos.length;i+=500)chunks.push(photos.slice(i,i+500).map(p=>p.id));
 const results=await Promise.all(chunks.map(async p_ids=>{
  try{return await client.rpc('vault_reaction_counts',{p_ids});}catch{return {data:[]};}
 }));
 for(const result of results)for(const row of result?.data||[]){
  if(!grouped.has(row.photo_id))grouped.set(row.photo_id,[]);
  grouped.get(row.photo_id).push({reaction:row.reaction,count:Number(row.count)});
 }
 for(const photo of photos)photo.reactions=grouped.get(photo.id)||[];
}
