export const SOCIAL_PLATFORMS = {
  Instagram: "https://www.instagram.com/",
  Facebook: "https://www.facebook.com/",
  TikTok: "https://www.tiktok.com/@",
  YouTube: "https://www.youtube.com/@",
  LinkedIn: "https://www.linkedin.com/in/",
  "X / Twitter": "https://x.com/",
  Threads: "https://www.threads.net/@",
  Pinterest: "https://www.pinterest.com/",
  Other: "",
};
export function socialUrl(profile) {
  const value = (profile.url || "").trim();
  if (!value) return "";
  if (!Object.hasOwn(SOCIAL_PLATFORMS, profile.platform)) throw new Error("Choose a social platform.");
  if (/^https?:\/\//i.test(value) || /^[^/]+\.[^/]+\//.test(value)) return webUrl(value);
  if (!SOCIAL_PLATFORMS[profile.platform]) throw new Error("Enter the full profile link for Other.");
  const handle = value.replace(/^@/, "");
  if (!/^[a-z\d_.-]+$/i.test(handle)) throw new Error("Enter a social handle or a full profile link.");
  return SOCIAL_PLATFORMS[profile.platform] + handle;
}
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
  product_name: "",
  product_description: "",
  product_url: "",
  product_photo: "",
  name: "",
  bio: "",
  category: CATEGORIES[0],
  venture: "parent",
  email: "",
  phone: "",
  phone_public: false,
  website: "",
  connect_url: "",
  location: "",
  photos: [],
  video: "",
  social_profiles: [],
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
  if ((listing.product_name || "").length > 100 || (listing.product_description || "").length > 400) throw new Error("Shorten the creation name or description.");
  const product_url = webUrl(listing.product_url);
  if (product_url.length > 500) throw new Error("Keep the learn more link under 501 characters.");
  const social_profiles = (listing.social_profiles || []).filter(p => p.url?.trim()).map(p => ({ platform: p.platform, url: socialUrl(p) }));
  if (social_profiles.some(p => p.url.length > 500)) throw new Error("Keep social profile links under 501 characters.");
  const website = webUrl(listing.website),
    connect_url = webUrl(listing.connect_url);
  // Email and phone are both required to publish. Email is the channel families
  // use, phone is how RCAP reaches the lister, and it stays private unless
  // phone_public is set. That guarantees every published listing has exactly one
  // contact route that is always visible.
  if (publish && !listing.bio.trim())
    throw new Error("Add a short bio before publishing.");
  if (publish && !String(listing.email || "").trim())
    throw new Error("Add a business email before publishing.");
  if (publish && !String(listing.phone || "").trim())
    throw new Error("Add a phone number before publishing. You can keep it private.");
  return {
    ...listing,
    name: listing.name.trim(),
    bio: listing.bio.trim(),
    website,
    connect_url,
    product_url,
    product_name: (listing.product_name || "").trim(),
    product_photo: listing.photos.includes(listing.product_photo) ? listing.product_photo : "",
    social_profiles,
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
      (!filters.reach || item.reach === filters.reach) &&
      (!filters.offer || (item.offers || []).includes(filters.offer)) &&
      (!filters.perks || Boolean(item.community_perk?.trim())) &&
      words.every((word) =>
        `${item.product_name || ""} ${item.product_description || ""} ${item.name} ${item.bio} ${item.category} ${item.location} ${item.community_perk || ""} ${item.collaboration_note || ""}`
          .toLowerCase()
          .includes(word),
      ),
  );
}
