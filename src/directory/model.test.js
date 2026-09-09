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
    // Email and phone are both required to publish; phone stays private unless
    // the lister opts in, so every listing has one contact route that shows.
    const withBio = { ...listing, bio: "Handmade art" };
    expect(() => validateListing(withBio, true)).toThrow("business email");
    expect(() =>
      validateListing({ ...withBio, email: "art@example.com" }, true),
    ).toThrow("phone number");
    const full = { ...withBio, email: "art@example.com", phone: "404 555 0100" };
    expect(validateListing(full, true).published).toBe(true);
    expect(validateListing(full, true).phone_public).toBe(false);
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

describe("Collective discovery", () => {
  const rows = [
    {
      ...emptyListing(),
      name: "Mentor Studio",
      bio: "Creative coaching",
      house: "amistad",
      reach: "worldwide",
      offers: ["mentor", "speaker"],
      community_perk: "Free first consultation",
    },
    {
      ...emptyListing(),
      name: "Student Sounds",
      bio: "DJ for celebrations",
      venture: "student",
      house: "isibindi",
      reach: "local",
      offers: ["collaborate"],
    },
    {
      ...emptyListing(),
      name: "Neighborhood Books",
      bio: "Stories",
      house: "amistad",
      reach: "local",
    },
  ];
  it("combines house, reach, opportunity, perk, and search filters", () => {
    expect(
      filterListings(rows, "consultation", "", false, {
        house: "amistad",
        reach: "worldwide",
        offer: "mentor",
        perks: true,
      }).map((r) => r.name),
    ).toEqual(["Mentor Studio"]);
    expect(
      filterListings(rows, "", "", true, {
        house: "isibindi",
        offer: "collaborate",
      }).map((r) => r.name),
    ).toEqual(["Student Sounds"]);
  });
  it("rejects invented houses and opportunity badges", () => {
    expect(() => validateListing({ ...rows[0], house: "unknown" })).toThrow(
      "house",
    );
    expect(() => validateListing({ ...rows[0], offers: ["verified"] })).toThrow(
      "opportunities",
    );
    expect(() =>
      validateListing({ ...rows[0], community_perk: "a".repeat(161) }),
    ).toThrow("Shorten");
  });
  it("keeps older listings without new optional fields searchable", () => {
    expect(
      filterListings(
        [{ name: "Original", bio: "Books", category: "Other", location: "" }],
        "original",
        "",
        false,
      ),
    ).toHaveLength(1);
  });
});
it('does not narrow businesses by a legacy house filter', () => {
 const rows=[{...emptyListing(),name:'One',house:'amistad'},{...emptyListing(),name:'Two',house:'isibindi'}];
 expect(filterListings(rows,'','',false,{house:'amistad'})).toHaveLength(2);
});
