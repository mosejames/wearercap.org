// @vitest-environment node
import { it, expect } from "vitest";
import { encrypt, decrypt } from "./storage.js";
it("stores authenticated encrypted state and rejects tampering", () => {
  process.env.LONDON_IMPORT_STATE_KEY = "ab".repeat(32);
  const value = { cursor: "private-cursor", items: [{ mediaId: "test" }] };
  const bytes = encrypt(value);
  expect(bytes.toString()).not.toContain("private-cursor");
  expect(decrypt(bytes)).toEqual(value);
  const corrupt = Buffer.from(bytes);
  corrupt[30] ^= 1;
  expect(() => decrypt(corrupt)).toThrow();
  delete process.env.LONDON_IMPORT_STATE_KEY;
});
