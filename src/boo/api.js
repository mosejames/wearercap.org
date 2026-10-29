import { authHeaders } from "../vault/auth.js";
export async function request(action, payload = {}) {
  const r = await fetch("/api/little-boo", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ action, ...payload }),
  });
  if (action === "media" && r.ok) return URL.createObjectURL(await r.blob());
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Please try again.");
  return data;
}
export async function preparePhoto(file) {
  if (
    !/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) &&
    !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
  )
    throw Error("Choose a JPEG, PNG, WebP or HEIC photo.");
  if (file.size > 25 * 1024 * 1024) throw Error("Choose a photo under 25 MB.");
  let image = file;
  try {
    const bitmap = await createImageBitmap(image, {
      imageOrientation: "from-image",
    });
    return await encode(bitmap);
  } catch (e) {
    if (!/hei[cf]/i.test(file.type + " " + file.name))
      throw Error("This photo could not be read. Try a JPEG copy.");
    const { heicTo } = await import("heic-to");
    image = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
    try {
      return await encode(
        await createImageBitmap(image, { imageOrientation: "from-image" }),
      );
    } catch {
      throw Error(
        "This HEIC photo could not be converted. Please choose a JPEG copy.",
      );
    }
  }
}
async function encode(bitmap) {
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  if (bitmap.width * bitmap.height > 40000000) {
    bitmap.close();
    throw Error("Choose a smaller photo.");
  }
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bitmap.width * scale));
  c.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  const image = c.toDataURL("image/jpeg", 0.84);
  c.width = c.height = 0;
  if (image.length > 4100000) throw Error("Choose a smaller photo.");
  return image.split(",")[1];
}
