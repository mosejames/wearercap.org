export const CATEGORIES = [
  "Arts, Books & Handmade",
  "Beauty & Personal Care",
  "Business & Professional Services",
  "Coaching & Consulting",
  "Education & Tutoring",
  "Events, Music & Entertainment",
  "Food & Catering",
  "Health & Therapy",
  "Home & Real Estate",
  "Shopping & Retail",
  "Sports & Fitness",
  "Technology & Media",
  "Travel & Experiences",
  "Other",
];
export const emptyListing = () => ({
  name: "",
  bio: "",
  category: CATEGORIES[0],
  venture: "parent",
  email: "",
  phone: "",
  website: "",
  connect_url: "",
  location: "",
  photos: [],
  published: false,
});
export function webUrl(value) {
  if (!value?.trim()) return "";
  const raw = value.trim();
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw))
    throw new Error("Use an http or https website address.");
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!url.hostname.includes(".") || url.username || url.password)
    throw new Error("Enter a complete website address.");
  return url.href;
}
export function validateListing(listing, publish = false) {
  if (!listing.name.trim())
    throw new Error("Give your business or venture a name.");
  if (listing.name.trim().length > 100 || listing.bio.length > 600)
    throw new Error(
      "Use a name under 101 characters and a bio under 601 characters.",
    );
  if (!CATEGORIES.includes(listing.category))
    throw new Error("Choose a category.");
  if (!["parent", "student"].includes(listing.venture))
    throw new Error("Choose a venture type.");
  if (listing.photos.length > 5)
    throw new Error("Choose one main photo and up to four more.");
  if (listing.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(listing.email))
    throw new Error("Enter a valid business email.");
  const website = webUrl(listing.website),
    connect_url = webUrl(listing.connect_url);
  if (
    publish &&
    (!listing.bio.trim() ||
      !(listing.email || listing.phone || website || connect_url))
  )
    throw new Error(
      "Add a short bio and at least one way to connect before publishing.",
    );
  return {
    ...listing,
    name: listing.name.trim(),
    bio: listing.bio.trim(),
    website,
    connect_url,
    published: publish,
  };
}
export function filterListings(listings, query, category, students) {
  const words = query.toLowerCase().trim().split(/\s+/);
  return listings.filter(
    (item) =>
      (!category || item.category === category) &&
      (!students || item.venture === "student") &&
      words.every((word) =>
        `${item.name} ${item.bio} ${item.category} ${item.location}`
          .toLowerCase()
          .includes(word),
      ),
  );
}
