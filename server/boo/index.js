import { randomBytes, randomUUID } from "node:crypto";
import { AwsClient } from "aws4fetch";
import sharp from "sharp";
import { seal, open, hash } from "./crypto.js";
import { adjudicate } from "./spelling.js";
const fail = (message, status = 400) =>
  Object.assign(Error(message), { status });
export async function rpc(action, payload, authorization) {
  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) throw fail("The game connection is not configured.", 503);
  const r = await fetch(base + "/rest/v1/rpc/boo_game", {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_action: action, p_payload: payload }),
    signal: AbortSignal.timeout(18000),
  });
  const data = await r.json();
  if (!r.ok)
    throw fail(
      data.message || "Could not complete this request.",
      data.code === "42501" ? 403 : data.code === "P0002" ? 404 : 400,
    );
  return data;
}
function store() {
  const e = process.env;
  if (
    !e.R2_ACCOUNT_ID ||
    !e.R2_BUCKET ||
    !e.R2_ACCESS_KEY_ID ||
    !e.R2_SECRET_ACCESS_KEY
  )
    throw fail("Photo storage is temporarily unavailable.", 503);
  const aws = new AwsClient({
    accessKeyId: e.R2_ACCESS_KEY_ID,
    secretAccessKey: e.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  return async (key, init = {}) => {
    if (!/^little-boo\/v1\/[a-f0-9-]{36}\.bin$/.test(key))
      throw fail("Invalid photo.");
    return aws.fetch(
      `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${e.R2_BUCKET}/${key}`,
      { ...init, signal: AbortSignal.timeout(20000) },
    );
  };
}
export async function cleanImage(bytes) {
  if (bytes.length > 3 * 1024 * 1024 || bytes.length < 20)
    throw fail("Choose a photo under 3 MB after phone preparation.");
  let metadata;
  try {
    metadata = await sharp(bytes, {
      limitInputPixels: 40000000,
      animated: false,
    }).metadata();
  } catch {
    throw fail("This image could not be read. Try a JPEG, PNG or WebP.");
  }
  if (!["jpeg", "png", "webp", "heif"].includes(metadata.format))
    throw fail("Choose a JPEG, PNG, WebP or HEIC photo.");
  try {
    return await sharp(bytes, { limitInputPixels: 40000000 })
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw fail("This format could not be converted. Try a JPEG copy.");
  }
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method === "GET" && req.query?.action === "phase") {
      const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        key =
          process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!base || !key)
        throw fail("The game schedule is temporarily unavailable.", 503);
      const response = await fetch(base + "/rest/v1/rpc/boo_phase", {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw fail("The game schedule is temporarily unavailable.", 503);
      return res.status(200).json(await response.json());
    }
    if (req.method === "GET" && req.query?.action === "status") {
      const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        key =
          process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      let phoneEnabled = false,
        authReachable = false,
        storageReachable = false;
      if (base && key) {
        try {
          const response = await fetch(base + "/auth/v1/settings", {
            headers: { apikey: key },
            signal: AbortSignal.timeout(5000),
          });
          const settings = await response.json();
          authReachable = response.ok;
          phoneEnabled = !!settings.external?.phone;
        } catch {}
      }
      try {
        const response = await store()(
          "little-boo/v1/00000000-0000-4000-8000-000000000000.bin",
          { method: "HEAD" },
        );
        storageReachable = response.ok || response.status === 404;
      } catch {}
      return res.status(200).json({
        game: "little-boo-v1",
        phoneEnabled,
        authReachable,
        storageReachable,
        aiConfigured: !!process.env.OPENAI_API_KEY,
        aiSpellingEnabled:
          process.env.BOO_NAME_AI_APPROVED === "true" &&
          !!process.env.OPENAI_API_KEY,
      });
    }
    const authorization = req.headers?.authorization;
    if (!/^Bearer [^\s]{20,8192}$/.test(authorization || ""))
      throw fail("Please sign in with your phone.", 401);
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      throw fail("Method not allowed.", 405);
    }
    let b = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!b || JSON.stringify(b).length > 4300000)
      throw fail("This request is too large.", 413);
    const a = b.action;
    if (a === "preview-access") {
      // Reuse the existing verified-phone + organizer-owner check. Never return
      // the admin payload or route rehearsal guesses to production scoring.
      await rpc("admin", {}, authorization);
      return res.status(200).json({ allowed: true });
    }
    if (a === "upload") {
      await rpc("get", { mode: b.mode }, authorization); // Authenticate before decoding or storage work.
      const source = Buffer.from(String(b.image || ""), "base64"),
        jpeg = await cleanImage(source),
        id = randomUUID(),
        key = `little-boo/v1/${id}.bin`,
        proof = randomBytes(32).toString("hex");
      const names = [
        String(b.name || "").slice(0, 80),
        ...(Array.isArray(b.aliases) ? b.aliases : []).slice(0, 10),
      ];
      const capsule = seal(
        Buffer.from(JSON.stringify({ names, proof })),
      ).toString("base64");
      const object = store();
      const put = await object(key, {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
          "Cache-Control": "private, no-store",
        },
        body: seal(jpeg),
      });
      if (!put.ok)
        throw fail("The photo could not be saved. Please try again.", 503);
      try {
        const result = await rpc(
          "upload",
          {
            ...b,
            image: undefined,
            id,
            key,
            hash: hash(jpeg),
            capsule,
            proofHash: hash(proof),
          },
          authorization,
        );
        return res.status(200).json(result);
      } catch (e) {
        await object(key, { method: "DELETE" }).catch(() => {});
        throw e;
      }
    }
    if (a === "media") {
      const { key } = await rpc("media", { id: b.id }, authorization);
      const r = await store()(key);
      if (!r.ok) throw fail("This photo is unavailable.", 404);
      const jpeg = open(Buffer.from(await r.arrayBuffer()));
      res.setHeader("Content-Type", "image/jpeg");
      return res.status(200).send(jpeg);
    }
    if (
      ![
        "get",
        "opening-notice",
        "drawing-results",
        "profile",
        "guess",
        "hint",
        "report",
        "remove",
        "admin",
        "resolve",
        "settings",
        "finalize",
      ].includes(a)
    )
      throw fail("Unsupported game request.");
    let result = await rpc(a, b, authorization);
    if (a === "guess" && result.pending) {
      const capsule = JSON.parse(
        open(Buffer.from(result.capsule, "base64")).toString(),
      );
      const payload = {
        id: b.id,
        pending: result.pending,
        proof: capsule.proof,
      };
      try {
        const correct = await adjudicate(result.guess, capsule.names);
        result = await rpc("judged", { ...payload, correct }, authorization);
      } catch (e) {
        await rpc("cancel-judge", payload, authorization).catch(() => {});
        throw fail(e.message, 503);
      }
    }
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 503).json({
      error: e.status
        ? e.message
        : "The game is temporarily unavailable. Your guess was not used. Please try again.",
    });
  }
}
