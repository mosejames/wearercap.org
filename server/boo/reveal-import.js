import sharp from "sharp";
import { seal, open, hash } from "./crypto.js";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function importPrivatePortrait(
  body,
  { rpc, storage, authorization },
) {
  // Authenticate as the existing organizer before decoding or storage work.
  await rpc("reveal-admin", {}, authorization);
  if (!uuid.test(body.id))
    throw Object.assign(Error("Invalid private portrait identity."), {
      status: 400,
    });
  const source = Buffer.from(String(body.image || ""), "base64");
  if (source.length === 0 || source.length > 2500000)
    throw Object.assign(Error("Choose a prepared JPEG under 2.5 MB."), {
      status: 400,
    });
  const image = sharp(source, { limitInputPixels: 40000000 });
  if ((await image.metadata()).format !== "jpeg")
    throw Object.assign(Error("Prepared school portraits must be JPEGs."), {
      status: 400,
    });
  const jpeg = await image
    .rotate()
    .resize({
      width: 1000,
      height: 2000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88 })
    .toBuffer();
  const meta = await sharp(jpeg).metadata(),
    key = `little-boo/reveal/v1/${body.id}.bin`;
  const put = await storage(key, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
      "If-None-Match": "*",
    },
    body: seal(jpeg),
    signal: AbortSignal.timeout(15000),
  });
  if (put.status === 412) {
    const existing = await storage(key, { signal: AbortSignal.timeout(15000) });
    if (
      !existing.ok ||
      hash(open(Buffer.from(await existing.arrayBuffer()))) !== hash(jpeg)
    )
      throw Object.assign(
        Error(
          "An existing private portrait differs. Stop and review the mapping.",
        ),
        { status: 409 },
      );
  } else if (!put.ok)
    throw Object.assign(
      Error(
        "Private portrait upload was not confirmed. No publication occurred.",
      ),
      { status: 503 },
    );
  // On uncertain database failure, retain encrypted bytes; never delete an object
  // that might already be registered. A retry verifies its exact content above.
  return rpc(
    "reveal-register-asset",
    {
      id: body.id,
      objectKey: key,
      hash: hash(jpeg),
      width: meta.width,
      height: meta.height,
    },
    authorization,
  );
}
