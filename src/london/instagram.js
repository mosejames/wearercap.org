// Attribution lives in the existing uploader field; imported media remains in R2.
export function instagramAccount(photo) {
  return /^Shared on Instagram by @([a-zA-Z0-9_.]{1,30})$/.exec(photo?.uploaderName || '')?.[1] || null;
}
