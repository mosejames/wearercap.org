// Private offline preparation only. No network, upload, database or publication.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";
const repository = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assetId(hash) {
  const x = hash.slice(0, 32).split("");
  x[12] = "5";
  x[16] = ((parseInt(x[16], 16) & 3) | 8).toString(16);
  const s = x.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
export async function prepareRevealManifest(
  manifest,
  { portraitRoot, outputRoot, allowedGameIds },
) {
  if (
    !Array.isArray(manifest.entries) ||
    !Array.isArray(allowedGameIds) ||
    !allowedGameIds.length
  )
    throw Error(
      "A confirmed manifest and authoritative game photo IDs are required.",
    );
  const root = await fs.realpath(portraitRoot),
    out = path.resolve(outputRoot);
  if (out === repository || out.startsWith(repository + path.sep))
    throw Error("Portrait outputs must stay outside the repository.");
  await fs.mkdir(out, { recursive: true, mode: 0o700 });
  await fs.chmod(out, 0o700);
  const known = new Set(allowedGameIds),
    seen = new Set(),
    assets = new Map(),
    entries = [];
  for (const e of manifest.entries) {
    if (
      !uuid.test(e.game_photo_id) ||
      !known.has(e.game_photo_id) ||
      seen.has(e.game_photo_id)
    )
      throw Error("Unknown or duplicate game photo ID.");
    if (
      e.confirmed !== true ||
      !Array.isArray(e.display_names) ||
      e.display_names.length < 1 ||
      e.display_names.length > 2 ||
      e.display_names.some(
        (n) => typeof n !== "string" || n.trim().length < 2 || n.length > 100,
      )
    )
      throw Error("Every entry needs explicit confirmed name labels.");
    if (
      !Array.isArray(e.portraits) ||
      e.portraits.length !== e.display_names.length
    )
      throw Error("Each named student needs one explicit current portrait.");
    seen.add(e.game_photo_id);
    const portraitIds = [];
    for (const relative of e.portraits) {
      if (
        typeof relative !== "string" ||
        path.isAbsolute(relative) ||
        relative.includes("\\") ||
        relative.split("/").includes("..") ||
        !/\.jpe?g$/i.test(relative)
      )
        throw Error("Invalid relative portrait path.");
      const source = await fs.realpath(path.resolve(root, relative));
      if (!source.startsWith(root + path.sep))
        throw Error("Portrait path leaves the private input directory.");
      const image = sharp(source, { limitInputPixels: 40000000 });
      if ((await image.metadata()).format !== "jpeg")
        throw Error("Expected verified JPEG portrait bytes.");
      const bytes = await image
        .rotate()
        .resize({
          width: 1000,
          height: 2000,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 88 })
        .toBuffer();
      const hash = createHash("sha256").update(bytes).digest("hex"),
        id = assetId(hash),
        destination = path.join(out, id + ".jpg");
      const info = await sharp(bytes).metadata();
      if (!assets.has(id)) {
        try {
          await fs.writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
        } catch (error) {
          if (
            error.code !== "EEXIST" ||
            createHash("sha256")
              .update(await fs.readFile(destination))
              .digest("hex") !== hash
          )
            throw error;
        }
        await fs.chmod(destination, 0o600);
        assets.set(id, {
          id,
          local_file: destination,
          object_key: `little-boo/reveal/v1/${id}.bin`,
          content_hash: hash,
          width: info.width,
          height: info.height,
          ready: false,
        });
      }
      if (portraitIds.includes(id))
        throw Error("A combined entry needs two distinct portrait assets.");
      portraitIds.push(id);
    }
    entries.push({
      game_photo_id: e.game_photo_id,
      display_names: e.display_names.map((n) => n.trim()),
      portrait_ids: portraitIds,
      confirmed: true,
    });
  }
  if (seen.size !== known.size)
    throw Error(
      "The manifest must cover every active game entry exactly once.",
    );
  const result = {
    publication_status: "held_private",
    portraits_cleared: false,
    assets: [...assets.values()],
    entries,
  };
  await fs.writeFile(
    path.join(out, "prepared-reveal.json"),
    JSON.stringify(result, null, 2),
    { mode: 0o600 },
  );
  await fs.chmod(path.join(out, "prepared-reveal.json"), 0o600);
  return result;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [manifestPath, portraitRoot, rosterPath, outputRoot] =
    process.argv.slice(2);
  if (!outputRoot)
    throw Error(
      "Usage: node scripts/prepare-boo-reveal.mjs MANIFEST PORTRAITS_ROOT PRIVATE_ROSTER OUTPUT_ROOT",
    );
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")),
    roster = JSON.parse(await fs.readFile(rosterPath, "utf8"));
  const result = await prepareRevealManifest(manifest, {
    portraitRoot,
    outputRoot,
    allowedGameIds: roster.map((x) => x.game_photo_id),
  });
  console.log(
    JSON.stringify({
      entries: result.entries.length,
      unique_portraits: result.assets.length,
      publication_status: result.publication_status,
    }),
  );
}
