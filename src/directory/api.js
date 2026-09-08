import { optimizePhoto, validateVideo } from "./media.js";
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
    video = "",
    published,
    house = "",
    reach = "local",
    offers = [],
    community_perk = "",
    product_name = "",
    product_description = "",
    product_url = "",
    product_photo = "",
    collaboration_note = "",
    social_profiles = [],
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
      video,
      published,
      house,
      reach,
      offers,
      community_perk,
      product_name,
      product_description,
      product_url,
      product_photo,
      collaboration_note,
      social_profiles,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function uploadPhoto(file, user, listingId) {
  const optimized = await optimizePhoto(file);
  const extension = optimized.type === "image/webp" ? "webp" : "png";
  const path = `${user.id}/${listingId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, optimized, { contentType: optimized.type, upsert: false });
  if (error) throw error;
  return path;
}
export async function removePhotos(paths) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw error;
}

export async function uploadVideo(file,user,listingId) {
 validateVideo(file);
 const path = `${user.id}/${listingId}/${crypto.randomUUID()}.${file.type === "video/mp4" ? "mp4" : "webm"}`;
 const {error}=await supabase.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false});
 if(error) throw error;
 return path;
}
