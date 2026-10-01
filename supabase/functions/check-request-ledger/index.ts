import { createClient } from "npm:@supabase/supabase-js@2.110.7";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const reply = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });

type Document = { bucket: string; path: string; name: string; url?: string };

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  const key = req.headers.get("x-rcap-ledger-key") || "";
  if (!/^[a-f0-9]{64}$/.test(key)) return reply({ error: "Unauthorized" }, 401);

  const { data, error } = await db.rpc("cr_ledger_snapshot", { p_key: key });
  if (error) console.error("Ledger snapshot RPC failed", error.code, error.message);
  if (error || !data) return reply({ error: "Unauthorized" }, 401);

  try {
    const archives = new Map<string, Document[]>();
    for (const entry of data.archives || []) {
      const list = archives.get(entry.request_id) || [];
      for (const file of entry.files || []) {
        if (file.path) list.push({
          bucket: "check-archives",
          path: file.path,
          name: file.name || file.path.split("/").at(-1),
        });
      }
      archives.set(entry.request_id, list);
    }

    for (const request of data.requests || []) {
      const seen = new Set<string>();
      const documents: Document[] = [];
      for (const item of request.items || []) {
        for (const receipt of item.receipts || []) {
          if (receipt.path) documents.push({
            bucket: "check-receipts",
            path: receipt.path,
            name: receipt.name || receipt.path.split("/").at(-1),
          });
        }
      }
      documents.push(...(archives.get(request.id) || []));
      request.documents = await Promise.all(documents.filter((document) => {
        const id = `${document.bucket}:${document.path}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      }).map(async (document) => {
        const { data: signed, error: signError } = await db.storage
          .from(document.bucket)
          .createSignedUrl(document.path, 600);
        if (signError || !signed?.signedUrl)
          throw new Error(`Could not sign ${document.bucket} document`);
        return { ...document, url: signed.signedUrl };
      }));
      delete request.items;
    }
    delete data.archives;
    return reply(data);
  } catch (cause) {
    console.error("Ledger document signing failed", cause);
    return reply({ error: "Ledger temporarily unavailable" }, 503);
  }
});
