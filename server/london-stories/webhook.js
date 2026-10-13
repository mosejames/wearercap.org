import { QueueClient } from "@vercel/queue";
import { END, TOPIC, verifySignature } from "./core.js";
import { readState } from "./storage.js";
import { sha256 } from "./core.js";
const queue = new QueueClient({ region: "iad1" });
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (
    req.method === "GET" &&
    req.headers.authorization &&
    sha256(req.headers.authorization) ===
      sha256("Bearer " + process.env.LONDON_IMPORT_STATE_KEY)
  ) {
    const [cursor, ledger, status] = await Promise.all(
      ["cursor", "ledger", "status"].map(readState),
    );
    return res.status(200).json({
      configured: !!process.env.DROPBOX_LONDON_REFRESH_TOKEN,
      trigger: "webhook",
      cursorReady: !!cursor.value?.cursor,
      checkedAt: cursor.value?.checkedAt,
      ledgerItems: ledger.value?.items?.length,
      status: status.value,
      photoRecorded: req.query?.photo
        ? !!ledger.value?.items?.some((x) => x.id === req.query.photo)
        : undefined,
    });
  }
  if (req.method === "GET" && typeof req.query?.challenge === "string") {
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(req.query.challenge);
  }
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) return res.status(413).end();
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks);
  if (
    !verifySignature(
      raw,
      req.headers["x-dropbox-signature"],
      process.env.DROPBOX_LONDON_APP_SECRET,
    )
  ) {
    console.warn("London Dropbox webhook: signature rejected");
    return res.status(401).json({ error: "Invalid signature" });
  }
  if (Date.now() > END) return res.status(200).json({ ok: true, quiet: true });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return res.status(400).end();
  }
  if (
    !body.list_folder?.accounts?.includes(process.env.DROPBOX_LONDON_ACCOUNT_ID)
  ) {
    console.warn("London Dropbox webhook: account ignored");
    return res.status(200).json({ ok: true, ignored: true });
  }
  try {
    await queue.send(
      TOPIC,
      body.cleanupTests
        ? {
            type: "cleanup-tests",
            ids: body.cleanupTests.ids,
            paths: body.cleanupTests.paths,
          }
        : { type: "scan", full: body.reconcile === true },
      { retentionSeconds: 604800 },
    );
    console.log("London Dropbox webhook: scan queued");
    return res.status(200).json({ ok: true });
  } catch {
    console.error("London stories: could not enqueue scan");
    return res.status(503).json({ error: "Please retry" });
  }
}
