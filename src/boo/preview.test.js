import { describe, it, expect, vi } from "vitest";
import { createPreview, PREVIEW_SCHEDULE } from "./preview.js";
function memory() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
    data,
  };
}
describe("isolated organizer rehearsal", () => {
  it("uses only fictional cards and the guessing-phase schedule", async () => {
    const p = createPreview("fictional-owner");
    const b = await p.request("get");
    expect(b.photos).toHaveLength(12);
    expect(b.isAdmin).toBe(false);
    expect(b.board.individual[0].uploadPoints).toBe(3);
    expect(PREVIEW_SCHEDULE.timezone).toBe("America/New_York");
    expect(b.photos.every((x) => x.id.startsWith("preview-"))).toBe(true);
    expect(b.photos[0].name).toBeUndefined();
  });
  it("models first and later unaided guesses with supplied nickname normalization", async () => {
    const p = createPreview("x");
    expect(
      await p.request("guess", { id: "preview-1", guess: " FABLE! " }),
    ).toEqual({ correct: true, points: 5 });
    expect(
      await p.request("guess", { id: "preview-2", guess: "Milo Moon" }),
    ).toEqual({ correct: true, points: 3 });
    expect((await p.request("get")).board.individual[0].points).toBe(11);
  });
  it("keeps hints and single committed attempts after refresh", async () => {
    const store = memory();
    let p = createPreview("x", store);
    await p.request("hint", { id: "preview-1" });
    p = createPreview("x", store);
    expect((await p.request("get")).photos[0].hinted).toBe(true);
    expect(
      await p.request("guess", { id: "preview-1", guess: "Fable Finch" }),
    ).toEqual({ correct: true, points: 1 });
    p = createPreview("x", store);
    await expect(
      p.request("guess", { id: "preview-1", guess: "Fable Finch" }),
    ).rejects.toThrow("already committed");
  });
  it("locks wrong answers without leaking a correct name in the result", async () => {
    const p = createPreview("x");
    expect(
      await p.request("guess", { id: "preview-1", guess: "Wrong" }),
    ).toEqual({ correct: false, points: 0 });
    await expect(p.request("hint", { id: "preview-1" })).rejects.toThrow(
      "already committed",
    );
    expect((await p.request("get")).photos[0].submitted).toBe(true);
  });
  it("excludes the own child and rejects every production-only operation", async () => {
    const p = createPreview("x");
    await expect(
      p.request("guess", { id: "preview-12", guess: "Your Fictional Boo" }),
    ).rejects.toThrow("own submission");
    for (const action of [
      "upload",
      "opening-notice",
      "admin",
      "settings",
      "finalize",
      "drawing-results",
      "preview-access",
    ])
      await expect(p.request(action)).rejects.toThrow(
        "cannot change the real game",
      );
  });
  it("resets only its own session namespace and never uses fetch", async () => {
    const store = memory();
    store.setItem("rcap-boo-journey-v1", "real-navigation-marker");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    try {
      const p = createPreview("x", store);
      await p.request("guess", { id: "preview-1", guess: "Fable Finch" });
      p.reset();
      expect(
        (await createPreview("x", store).request("get")).photos[0].submitted,
      ).toBe(false);
      expect(store.getItem("rcap-boo-journey-v1")).toBe(
        "real-navigation-marker",
      );
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
