import { describe, it, expect } from "vitest";
import {
  emptyListing,
  validateListing,
  webUrl,
  filterListings,
} from "./model.js";
describe("directory publishing", () => {
  it("allows a named draft but requires a bio and contact for publication", () => {
    const listing = { ...emptyListing(), name: "A new venture" };
    expect(validateListing(listing).published).toBe(false);
    expect(() => validateListing(listing, true)).toThrow("short bio");
    expect(
      validateListing(
        { ...listing, bio: "Handmade art", email: "art@example.com" },
        true,
      ).published,
    ).toBe(true);
  });
  it("rejects unsafe links and accepts websites without a scheme", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,test",
      "ftp://example.com",
      "https://user:pass@example.com",
    ])
      expect(() => webUrl(url)).toThrow();
    expect(webUrl("example.com/shop")).toBe("https://example.com/shop");
  });
  it("enforces five photos and a valid contact email", () => {
    expect(() =>
      validateListing({
        ...emptyListing(),
        name: "Books",
        photos: Array(6).fill("photo"),
      }),
    ).toThrow("four more");
    expect(() =>
      validateListing({ ...emptyListing(), name: "Books", email: "bad@" }),
    ).toThrow("email");
  });
  it("combines category, student, and case-insensitive search filters", () => {
    const rows = [
      {
        name: "DJ Future",
        bio: "Music for parties",
        category: "Events, Music & Entertainment",
        venture: "student",
        location: "Atlanta",
      },
      {
        name: "DJ Parent",
        bio: "Music",
        category: "Events, Music & Entertainment",
        venture: "parent",
        location: "Atlanta",
      },
    ];
    expect(
      filterListings(
        rows,
        "MUSIC atlanta",
        "Events, Music & Entertainment",
        true,
      ).map((r) => r.name),
    ).toEqual(["DJ Future"]);
    expect(filterListings(rows, "book", "", false)).toEqual([]);
  });
});
