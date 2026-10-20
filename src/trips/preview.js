// Deliberately has no database, R2, London auth or analytics dependencies.
import { NYC } from './config.js';
export async function fingerprint(file) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
}
export async function preparePreview(files, existing, details, prepare) {
    const known = new Set(existing.map(p => p.hash)), photos = [], errors = [];
    let skipped = 0;
    for (const file of files.slice(0, 60)) {
        if (file.size > 50 * 1024 * 1024) {
            errors.push(`${file.name}: please choose a photo under 50 MB.`);
            continue;
        }
        if (!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
            errors.push(`${file.name}: choose a photo. Video contributions will have a separate destination.`);
            continue;
        }
        try {
            const hash = await fingerprint(file);
            if (known.has(hash)) {
                skipped++;
                continue;
            }
            const image = await prepare(file);
            photos.push({ id: image.id, vault: NYC.id, hash, web: URL.createObjectURL(image.web), thumb: URL.createObjectURL(image.thumb), takenAt: image.takenAt?.toISOString() || '', createdAt: new Date().toISOString(), ...details, thanks: false, comments: [], reactions: [] });
            known.add(hash);
        }
        catch {
            errors.push(`${file.name}: could not read this photo. Please try a JPEG.`);
        }
    }
    return { photos, skipped, errors };
}
