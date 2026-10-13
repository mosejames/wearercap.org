import { createBoothTokenProvider } from "../../api/booth-ingest.js";
// Same verified contributor and password grant as the booth. Never rotate a
// refresh token in an immutable environment variable.
let provider;
export function supabaseConfig() {
  return {
    url: (
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      ""
    ).replace(/\/+$/, ""),
    key:
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
  };
}
export async function contributor() {
  const { url, key } = supabaseConfig();
  provider ||= createBoothTokenProvider({
    url,
    key,
    phone: process.env.SUPABASE_BOOTH_PHONE,
    password: process.env.SUPABASE_BOOTH_PASSWORD,
  });
  const token = await provider();
  const claim = await rest("rpc/london_claim_account", token, {
    method: "POST",
    body: JSON.stringify({
      p_token: "london-instagram-contributor-v1-verified",
    }),
  });
  const owner = await rest("rpc/london_verified_owner", token, {
    method: "POST",
    body: "{}",
  });
  if (!claim.token || !/^[a-f0-9]{64}$/.test(owner))
    throw Error("London contributor unavailable");
  return { token, owner, sharingToken: claim.token };
}
export async function rest(route, token, init = {}) {
  const { url, key } = supabaseConfig();
  const r = await fetch(url + "/rest/v1/" + route, {
    ...init,
    headers: {
      apikey: key,
      Authorization: "Bearer " + (token || key),
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    const e = new Error(
      "Vault request failed: " + r.status + " (" + route.split("?")[0] + ")",
    );
    e.status = r.status;
    throw e;
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}
