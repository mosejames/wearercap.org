import { supabase } from "../carpool/supabaseClient.js";
export { supabase };
export const BUCKET = "directory-photos";
export async function photoUrl(path) {
  if (!path) return "";
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export async function listBusinesses(owner) {
  let query = supabase.from("directory_listings").select("*").order("name");
  query = owner ? query.eq("owner_id", owner) : query.eq("published", true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
export async function saveBusiness(listing, user) {
  const {
    id,
    name,
    bio,
    category,
    venture,
    email,
    phone,
    website,
    connect_url,
    location,
    photos,
    published,
  } = listing;
  const { data, error } = await supabase
    .from("directory_listings")
    .upsert({
      id,
      owner_id: user.id,
      name,
      bio,
      category,
      venture,
      email,
      phone,
      website,
      connect_url,
      location,
      photos,
      published,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function uploadPhoto(file, user, listingId) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Each photo must be 5 MB or smaller.");
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[file.type];
  const path = `${user.id}/${listingId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}
export async function removePhotos(paths) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw error;
}
