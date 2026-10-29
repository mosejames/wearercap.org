import { describe, it, expect, vi } from "vitest";
import {
  readJourney,
  saveJourney,
  defaultPlayerName,
  splitNames,
} from "./journey.js";
function storage() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k),
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
    data,
  };
}
describe("private onboarding navigation", () => {
  it("stores intent flags only, never photo/name/phone fields", () => {
    const s = storage();
    saveJourney(
      {
        kind: "upload",
        mode: "children",
        hadPhoto: true,
        name: "Fictional Child",
        image: "PRIVATE_PHOTO_BYTES",
        phone: "5550001234",
        aliases: ["Secret Alias"],
      },
      s,
    );
    const raw = [...s.data.values()][0];
    expect(raw).not.toMatch(/Fictional|PRIVATE|555000|Secret/);
    expect(readJourney(s)).toEqual({
      kind: "upload",
      mode: "children",
      hadPhoto: true,
      photoId: null,
    });
  });
  it("recovers guess intent but rejects corrupt, old and unsupported navigation", () => {
    const s = storage();
    saveJourney(
      {
        kind: "guess",
        mode: "adults",
        photoId: "b0000000-0000-4000-8000-000000000001",
      },
      s,
    );
    expect(readJourney(s).photoId).toBe("b0000000-0000-4000-8000-000000000001");
    for (const value of [
      "broken",
      '{"kind":"email","mode":"children","at":1}',
      '{"kind":"upload","mode":"children","at":1}',
    ]) {
      s.setItem("rcap-boo-journey-v1", value);
      expect(readJourney(s)).toBeNull();
    }
    saveJourney(null, s);
    expect(s.data.size).toBe(0);
  });
  it("tolerates unavailable browser storage", () => {
    const s = {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
      removeItem: () => {
        throw Error("blocked");
      },
    };
    expect(readJourney(s)).toBeNull();
    expect(() =>
      saveJourney({ kind: "upload", mode: "children" }, s),
    ).not.toThrow();
  });
  it("uses a non-phone public alias when no parent name is collected", () => {
    expect(defaultPlayerName("a0000000-0000-4000-8000-000000000002")).toBe(
      "Boo Player 000002",
    );
    expect(splitNames(" Fictional One, Fictional Two , ")).toEqual([
      "Fictional One",
      "Fictional Two",
    ]);
  });
});
