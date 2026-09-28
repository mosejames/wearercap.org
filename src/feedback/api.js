import { createClient } from "@supabase/supabase-js";
// Deliberately isolated from the Capsule's authenticated client and storage.
export const client = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
export async function call(action, payload = {}) {
  const { data, error } = await client.rpc("rcap_feedback", {
    p_action: action,
    p_payload: payload,
  });
  if (error) throw new Error(error.message);
  return data;
}
export async function sendVoice(survey, id, blob, permission, duration) {
  await call("voice", {
    survey,
    id,
    permission,
    duration,
    mime: blob.type.split(";")[0],
  });
  const { error } = await client.storage
    .from("rcap-feedback-voices")
    .upload(`${id}/recording`, blob, {
      contentType: blob.type.split(";")[0],
      headers: { "x-feedback-token": id },
      upsert: false,
    });
  // A retry can find an upload that succeeded before its response was lost.
  if (error && !/already exists|duplicate/i.test(error.message)) throw error;
  await call("voice_finish", { id });
}
export async function voiceUrl(id, pass) {
  const scoped = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { headers: { "x-feedback-admin": pass } },
    },
  );
  const { data, error } = await scoped.storage
    .from("rcap-feedback-voices")
    .createSignedUrl(`${id}/recording`, 300);
  if (error) throw error;
  return data.signedUrl;
}
