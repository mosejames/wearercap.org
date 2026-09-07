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
export const HOUSES = [
  { name: "Amistad", color: "#f17e8a", key: "amistad" },
  { name: "Isibindi", color: "#77cfa0", key: "isibindi" },
  { name: "Rêveur", color: "#7eaafb", key: "reveur" },
  { name: "Altruismo", color: "#d9d6ce", key: "altruismo" },
];
export const OFFERS = [
  {
    key: "mentor",
    label: "Student mentorship",
    action: "Available to mentor",
    description: "Help a student turn an idea into a next step.",
  },
  {
    key: "speaker",
    label: "Career-day speaking",
    action: "Available to speak",
    description: "Bring your work and experience into the conversation.",
  },
  {
    key: "internship",
    label: "Internships & job shadowing",
    action: "Learning opportunities",
    description: "Offer a window into your profession.",
  },
  {
    key: "collaborate",
    label: "Business collaboration",
    action: "Open to collaboration",
    description: "Connect with another family to make something happen.",
  },
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
  house: "",
  reach: "local",
  offers: [],
  community_perk: "",
  collaboration_note: "",
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
  if (listing.house && !HOUSES.some((house) => house.key === listing.house))
    throw new Error("Choose an RCA house or leave it blank.");
  if (listing.reach && !["local", "worldwide"].includes(listing.reach))
    throw new Error("Choose a service reach.");
  if (
    (listing.offers || []).some(
      (offer) => !OFFERS.some((option) => option.key === offer),
    )
  )
    throw new Error("Choose one of the community opportunities.");
  if (
    (listing.community_perk || "").length > 160 ||
    (listing.collaboration_note || "").length > 280
  )
    throw new Error("Shorten your community offer or collaboration note.");
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
export function filterListings(
  listings,
  query,
  category,
  students,
  filters = {},
) {
  const words = query.toLowerCase().trim().split(/\s+/);
  return listings.filter(
    (item) =>
      (!category || item.category === category) &&
      (!students || item.venture === "student") &&
      (!filters.house || item.house === filters.house) &&
      (!filters.reach || item.reach === filters.reach) &&
      (!filters.offer || (item.offers || []).includes(filters.offer)) &&
      (!filters.perks || Boolean(item.community_perk?.trim())) &&
      words.every((word) =>
        `${item.name} ${item.bio} ${item.category} ${item.location} ${item.community_perk || ""} ${item.collaboration_note || ""}`
          .toLowerCase()
          .includes(word),
      ),
  );
}
