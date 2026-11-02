// Private prepared files only. Validate every byte reference before the first write.
export async function importPreparedReveal(files, request, progress = () => {}) {
  const manifests = files.filter(f => f.name === 'prepared-reveal.json');
  if (manifests.length !== 1) throw Error('Choose the folder containing one prepared-reveal.json.');
  const manifest = JSON.parse(await manifests[0].text());
  if (manifest.publication_status !== 'held_private' || !Array.isArray(manifest.assets) || !Array.isArray(manifest.entries) || !manifest.entries.length) throw Error('Use a privately prepared reveal folder.');
  const ids = new Set();
  const uploads = manifest.assets.map(asset => {
    if (!/^[0-9a-f-]{36}$/i.test(asset.id) || ids.has(asset.id)) throw Error('Invalid or duplicate portrait identity.');
    ids.add(asset.id);
    const filename = String(asset.local_file).split(/[\\/]/).pop();
    const matches = files.filter(f => f.name === filename);
    if (matches.length !== 1 || !/\.jpe?g$/i.test(filename) || matches[0].size > 2500000 || !matches[0].size) throw Error('Each prepared portrait needs one JPEG under 2.5 MB.');
    return { id: asset.id, file: matches[0] };
  });
  for (const entry of manifest.entries) {
    if (!entry.confirmed || !Array.isArray(entry.portrait_ids) || !entry.portrait_ids.every(id=>ids.has(id))) throw Error('Use confirmed complete portrait mappings.');
  }
  await request('reveal-admin');
  for (const [i, upload] of uploads.entries()) {
    progress(`Importing private portrait ${i+1} of ${uploads.length}…`);
    const image = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('The selected portrait could not be read.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(upload.file);});
    await request('reveal-upload', {id: upload.id, image});
  }
  await request('reveal-register-entries', {entries: manifest.entries});
  progress(`Prepared ${manifest.entries.length} entries for private review. Nothing was published.`);
}
