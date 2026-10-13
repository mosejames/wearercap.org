// @vitest-environment node
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  mediaPath,
  idFor,
  metadataFor,
  verifySignature,
  dropboxHash,
} from "./core.js";
const root = "/RCA 2028 Trip Videos/From Their Stories/Originals";
describe("London Dropbox boundaries", () => {
  it("accepts media only in account folders", () => {
    expect(mediaPath(root + "/kimbearden/a.mp4")?.kind).toBe("video");
    for (const p of [
      root + "/kimbearden/a.mp4.json",
      root + "/../a.jpg",
      root + "/kimbearden/nested/a.jpg",
      "/other/Originals/kimbearden/a.jpg",
    ])
      expect(mediaPath(p)).toBeNull();
  });
  it("is stable on redelivery and separates changed contents", () => {
    expect(idFor(root + "/kimbearden/a.jpg", "a")).toBe(
      idFor(root.toLowerCase() + "/kimbearden/a.jpg", "a"),
    );
    expect(idFor(root + "/kimbearden/a.jpg", "b")).not.toBe(
      idFor(root + "/kimbearden/a.jpg", "a"),
    );
  });
  it("uses only validated source attribution and capture time", () => {
    const r = metadataFor(
      {
        account: "kimbearden",
        media_pk: "123",
        taken_at: "2026-10-13T09:00:00Z",
        caption: "not copied",
        child_name: "not copied",
      },
      root + "/kimbearden/a.jpg",
    );
    expect(r.credit).toBe("Shared on Instagram by @kimbearden");
    expect(r.caption).toBeUndefined();
    expect(r.child_name).toBeUndefined();
    expect(() =>
      metadataFor(
        { account: "wrong", media_pk: "123", taken_at: "2026-10-13" },
        root + "/kimbearden/a.jpg",
      ),
    ).toThrow();
  });
  it("authenticates the exact raw Dropbox body", () => {
    const raw = Buffer.from('{"list_folder":{}}'),
      secret = "test";
    const signature = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("hex");
    expect(verifySignature(raw, signature, secret)).toBe(true);
    expect(verifySignature(Buffer.from("{}"), signature, secret)).toBe(false);
    expect(verifySignature(raw, "bad", secret)).toBe(false);
  });
  it("implements Dropbox block hashing", () => {
    const b = Buffer.from("hello");
    const expected = crypto
      .createHash("sha256")
      .update(crypto.createHash("sha256").update(b).digest())
      .digest("hex");
    expect(dropboxHash(b)).toBe(expected);
  });
});
