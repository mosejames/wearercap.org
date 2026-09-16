// Hash the selected bytes before conversion so renamed files still match.
export async function fingerprint(file) {
  const bytes = file.arrayBuffer ? await file.arrayBuffer() : await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not check this file for duplicates.'));
    reader.readAsArrayBuffer(file);
  });
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

export const isDuplicateError = error => error?.code === '23505'
  && `${error.message || ''} ${error.details || ''}`.includes('vault_photos_event_content_hash_key');
