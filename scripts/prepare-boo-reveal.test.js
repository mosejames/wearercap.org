// @vitest-environment node
import { it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { prepareRevealManifest } from "./prepare-boo-reveal.mjs";
it("prepares private metadata-free portraits, keeping alias entries distinct and a two-child entry paired", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "boo-private-prepare-")),
    input = path.join(root, "input"),
    out = path.join(root, "out");
  await fs.mkdir(input);
  try {
    for (const [n, color] of [
      ["one.jpg", "#234567"],
      ["two.jpg", "#976542"],
    ])
      await sharp({
        create: { width: 1200, height: 1600, channels: 3, background: color },
      })
        .jpeg()
        .withMetadata({ orientation: 1 })
        .toFile(path.join(input, n));
    const ids = [1, 2, 3].map(
        (n) => `a4000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      ),
      manifest = {
        entries: [
          {
            game_photo_id: ids[0],
            display_names: ["Fictional Canonical"],
            portraits: ["one.jpg"],
            confirmed: true,
          },
          {
            game_photo_id: ids[1],
            display_names: ["Fictional Canonical"],
            portraits: ["one.jpg"],
            confirmed: true,
          },
          {
            game_photo_id: ids[2],
            display_names: ["Fictional A", "Fictional B"],
            portraits: ["one.jpg", "two.jpg"],
            confirmed: true,
          },
        ],
      };
    const prepared = await prepareRevealManifest(manifest, {
      portraitRoot: input,
      outputRoot: out,
      allowedGameIds: ids,
    });
    expect(prepared.entries).toHaveLength(3);
    expect(prepared.assets).toHaveLength(2);
    expect(prepared.entries[0].portrait_ids).toEqual(
      prepared.entries[1].portrait_ids,
    );
    expect(prepared.entries[2].portrait_ids).toHaveLength(2);
    expect(prepared.portraits_cleared).toBe(false);
    expect(prepared.assets.every((x) => !x.ready)).toBe(true);
    for (const a of prepared.assets) {
      const m = await sharp(a.local_file).metadata();
      expect(m.width).toBeLessThanOrEqual(1000);
      expect(m.exif).toBeUndefined();
      expect((await fs.stat(a.local_file)).mode & 0o777).toBe(0o600);
    }
    expect((await fs.stat(out)).mode & 0o777).toBe(0o700);
    await expect(
      prepareRevealManifest(
        { entries: [{ ...manifest.entries[0], portraits: ["../escape.jpg"] }] },
        { portraitRoot: input, outputRoot: out, allowedGameIds: [ids[0]] },
      ),
    ).rejects.toThrow("relative");
    await expect(
      prepareRevealManifest(
        { entries: [manifest.entries[0], manifest.entries[0]] },
        { portraitRoot: input, outputRoot: out, allowedGameIds: ids },
      ),
    ).rejects.toThrow("duplicate");
    await expect(
      prepareRevealManifest(
        { entries: [manifest.entries[0]] },
        { portraitRoot: input, outputRoot: out, allowedGameIds: ids },
      ),
    ).rejects.toThrow("cover");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
