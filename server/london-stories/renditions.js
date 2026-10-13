import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
const exec = promisify(execFile);
export const fingerprint = async (bytes) => [
  ...(await sharp(bytes)
    .rotate()
    .resize(32, 32, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer()),
];
export async function renditions(bytes, kind) {
  let input = bytes,
    playback = null,
    duration = null;
  const dir =
    kind === "video"
      ? await fs.mkdtemp(path.join(os.tmpdir(), "london-story-"))
      : null;
  try {
    if (dir) {
      const original = path.join(dir, "original.mp4"),
        poster = path.join(dir, "poster.jpg"),
        compatible = path.join(dir, "playback.mp4");
      await fs.writeFile(original, bytes);
      await exec(
        ffmpeg,
        ["-y", "-v", "error", "-i", original, "-frames:v", "1", poster],
        { timeout: 90000, maxBuffer: 1024 * 1024 },
      );
      input = await fs.readFile(poster);
      const { stdout } = await exec(
        ffmpeg,
        [
          "-y",
          "-v",
          "error",
          "-i",
          original,
          "-map",
          "0:v:0",
          "-map",
          "0:a?",
          "-map_metadata",
          "-1",
          "-vf",
          "scale=1280:1280:force_original_aspect_ratio=decrease:force_divisible_by=2",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-pix_fmt",
          "yuv420p",
          "-profile:v",
          "main",
          "-c:a",
          "aac",
          "-b:a",
          "96k",
          "-movflags",
          "+faststart",
          "-progress",
          "pipe:1",
          "-nostats",
          compatible,
        ],
        { timeout: 200000, maxBuffer: 1024 * 1024 },
      );
      playback = await fs.readFile(compatible);
      const times = [...stdout.matchAll(/out_time_us=(\d+)/g)];
      duration = times.length ? Number(times.at(-1)[1]) / 1e6 : null;
    }
    const web = await sharp(input)
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();
    const thumb = await sharp(input)
      .rotate()
      .resize({
        width: 560,
        height: 560,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    const meta = await sharp(web).metadata();
    return {
      web,
      thumb,
      playback,
      duration,
      width: meta.width,
      height: meta.height,
      fp: kind === "photo" ? await fingerprint(input) : null,
    };
  } finally {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  }
}
