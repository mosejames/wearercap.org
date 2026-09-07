import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  Store,
  Mail,
  Phone,
  Globe,
  Sparkles,
  Gift,
  Handshake,
} from "lucide-react";
import {
  SOCIAL_PLATFORMS,
  socialUrl,
  CATEGORIES,
  HOUSES,
  OFFERS,
  emptyListing,
  validateListing,
  webUrl,
} from "./model.js";
import {
  supabase,
  listBusinesses,
  saveBusiness,
  uploadPhoto,
  removePhotos,
} from "./api.js";

import Visibility, { DEFAULT_VISIBILITY } from "./Visibility.jsx";
import SocialIcon from "./SocialIcon.jsx";
import Collective from "./Collective.jsx";
import { Card, Photo, SafeLink, HouseBadge } from "./ListingUI.jsx";
import { go } from "./navigation.js";
export { Card } from "./ListingUI.jsx";

function currentRoute() {
  return new URLSearchParams(window.location.search);
}
export function SignIn({ onError, nextView = "manage" }) {
  const [email, setEmail] = useState(""),
    [sent, setSent] = useState(false),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false);
  const callback = new URL(window.location.href);
  callback.pathname = callback.pathname.replace(/\/?$/, "/");
  callback.search = `?view=${nextView}`;
  callback.hash = "";
  const redirectTo = callback.href;
  async function signIn(provider) {
    setBusy(true);
    onError("");
    try {
      const result = provider
        ? await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo },
          })
        : await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: { emailRedirectTo: redirectTo },
          });
      if (result.error) throw result.error;
      if (!provider) setSent(true);
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function verifyCode(e) {
    e.preventDefault();
    setBusy(true);
    onError("");
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(), token: code.trim(), type: "email",
      });
      if (error) throw error;
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="dir-signin">
      <span className="dir-eyebrow">A place for what you do</span>
      <h1>Let the community find you.</h1>
      <p>
        Sign in to create and manage your listings. Have a student entrepreneur
        at home? Manage their venture here, too.
      </p>
      <button
        className="dir-button"
        disabled={busy}
        onClick={() => signIn("google")}
      >
        Continue with Google
      </button>
      <div className="dir-divider">or use your email</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn();
        }}
      >
        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            disabled={busy || sent}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button className="dir-button dir-secondary" disabled={busy || sent}>
          {busy
            ? "Please wait…"
            : sent
              ? "Code sent"
              : "Email me a sign-in code"}
        </button>
      </form>
      {sent && (
        <>
          <p role="status">Enter the code sent to {email.trim()}. If your email includes a sign-in link, you can use that too.</p>
          <form onSubmit={verifyCode}>
            <label>
              Sign-in code
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]+"
                required autoFocus disabled={busy} />
            </label>
            <button className="dir-button" disabled={busy || !code.trim()}>
              {busy ? "Please wait…" : "Verify code and sign in"}
            </button>
          </form>
          <button className="dir-button dir-secondary" disabled={busy} onClick={() => signIn()}>Resend code</button>
          <button className="dir-button dir-secondary" disabled={busy} onClick={() => { setSent(false); setCode(""); onError(""); }}>Use a different email</button>
        </>
      )}
      <small>
        Use the same sign-in method each time to find your listings.
      </small>
    </section>
  );
}

export function Editor({
  initial,
  user,
  onSaved,
  onError,
  defaultVenture = "parent",
}) {
  const [form, setForm] = useState(() => ({
    ...emptyListing(),
    id: crypto.randomUUID(),
    venture: defaultVenture,
    ...initial,
  }));
  const [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(Boolean(initial?.published)),
    [dirty, setDirty] = useState(false),
    [preview, setPreview] = useState(false);
  const [added, setAdded] = useState([]),
    [removed, setRemoved] = useState([]);
  useEffect(() => {
    const warn = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };
  async function upload(e) {
    const files = [...e.target.files];
    e.target.value = "";
    onError("");
    if (files.length + form.photos.length > 5) {
      onError(
        "You can have one main photo and four additional photos. Remove a photo first to make room.",
      );
      return;
    }
    setBusy(true);
    try {
      for (const file of files) {
        const path = await uploadPhoto(file, user, form.id);
        setForm((f) => ({ ...f, photos: [...f.photos, path] }));
        setAdded((a) => [...a, path]);
        setDirty(true);
      }
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(publish) {
    onError("");
    setBusy(true);
    try {
      const valid = validateListing(form, publish);
      if (publish && !consent)
        throw new Error(
          "Confirm that you have permission to share this listing.",
        );
      const saved = await saveBusiness(valid, user);
      setDirty(false);
      try {
        await removePhotos(removed);
      } catch {
        /* Saved listing is authoritative; cleanup must not make a successful save look failed. */
      }
      onSaved(saved);
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setBusy(true);
    try {
      await removePhotos(added);
    } catch {
      /* Never remove images referenced by the saved listing on cancel. */
    }
    setDirty(false);
    go("manage");
  }
  const field = (key, label, type = "text", maxLength = 200) => (
    <label>
      {label}
      <input
        type={type}
        maxLength={maxLength}
        value={form[key]}
        onChange={(e) => update(key, e.target.value)}
      />
    </label>
  );
  return (
    <section className="dir-editor">
      <button className="dir-text-button" disabled={busy} onClick={cancel}>
        <ArrowLeft size={17} /> My listings
      </button>
      <div className="dir-section-heading">
        <div>
          <span className="dir-eyebrow">Your corner of the community</span>
          <h1>{initial ? "Edit your listing." : "What do you do?"}</h1>
        </div>
        <button
          className="dir-button dir-secondary"
          type="button"
          onClick={() => setPreview(!preview)}
        >
          {preview ? "Back to editing" : "Preview listing"}
        </button>
      </div>
      {preview ? (
        <>
          <p className="dir-notice">
            Preview only. Your changes have not been saved.
          </p>
          <Details item={form} preview />
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(true);
          }}
        >
          <fieldset disabled={busy}>
            <div className="dir-form-section">
              <div>
                <span className="dir-step">01</span>
                <h2>Tell your story.</h2>
                <p>
                  A business, a side project, a creative calling. There is room
                  for all of it.
                </p>
              </div>
              <div className="dir-fields">
                {field("name", "Business or venture name *", "text", 100)}
                <div className="dir-two">
                  <label>
                    Category
                    <select
                      value={form.category}
                      onChange={(e) => update("category", e.target.value)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Who runs this venture?
                    <select
                      value={form.venture}
                      onChange={(e) => update("venture", e.target.value)}
                    >
                      <option value="parent">Parent / guardian</option>
                      <option value="student">Student venture</option>
                    </select>
                  </label>
                </div>
                {form.venture === "student" && (
                  <p className="dir-notice">
                    A parent or guardian manages this listing. Use an adult’s
                    business contact details and leave out school schedules,
                    ages, and personal addresses.
                  </p>
                )}
                <label>
                  Short bio *
                  <textarea
                    rows={5}
                    maxLength={600}
                    value={form.bio}
                    onChange={(e) => update("bio", e.target.value)}
                    placeholder="What do you offer, and who can you help?"
                  />
                  <small>{form.bio.length}/600 characters</small>
                </label>
                {field(
                  "location",
                  "City or service area (optional)",
                  "text",
                  100,
                )}
                <div className="dir-two">
                  <label>
                    House (optional)
                    <select
                      value={form.house}
                      onChange={(e) => update("house", e.target.value)}
                    >
                      <option value="">No house selected</option>
                      {HOUSES.map((h) => (
                        <option key={h.key} value={h.key}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Service reach
                    <select
                      value={form.reach}
                      onChange={(e) => update("reach", e.target.value)}
                    >
                      <option value="local">Local / in person</option>
                      <option value="worldwide">Online / worldwide</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
            <div className="dir-form-section">
              <div>
                <span className="dir-step">02</span>
                <h2>Show your work.</h2>
                <p>
                  Your first image is the main photo. Add a logo, book covers,
                  artwork, or a glimpse of your setup.
                </p>
                <small>Up to 5 images. JPG, PNG, or WebP. 5 MB each.</small>
              </div>
              <div className="dir-fields">
                <div className="dir-upload-grid">
                  {form.photos.map((path, index) => (
                    <div className="dir-upload-photo" key={path}>
                      <Photo
                        path={path}
                        name={`${form.name || "Listing"} photo ${index + 1}`}
                      />
                      <span>
                        {index === 0 ? "Main photo" : `Photo ${index + 1}`}
                      </span>
                      <div>
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              update("photos", [
                                path,
                                ...form.photos.filter((p) => p !== path),
                              ])
                            }
                          >
                            Make main
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setRemoved((r) => [...r, path]);
                            update(
                              "photos",
                              form.photos.filter((p) => p !== path),
                            );
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {form.photos.length < 5 && (
                  <label className="dir-upload">
                    <Plus size={22} /> Add photos
                    <input
                      aria-label="Add photos"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={upload}
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="dir-form-section">
              <div><span className="dir-eyebrow">For authors & makers</span><h2>Spotlight something you created.</h2><p>Feature a book, artwork, handmade piece, or other product. Tell its story and invite visitors to learn more. This is an introduction, with no checkout or sales handled here.</p></div>
              <div className="dir-fields">
                {field("product_name", "Featured creation (optional)", "text", 100)}
                <label>About this creation<textarea maxLength={400} value={form.product_description} onChange={e => update("product_description", e.target.value)} placeholder="What did you create, and what makes it special?" /></label>
                {field("product_url", "Learn more link (optional)", "text", 500)}
                <label>Spotlight photo<select value={form.product_photo || ""} onChange={e => update("product_photo", e.target.value)}><option value="">Use main listing photo</option>{form.photos.map((photo, index) => <option key={photo} value={photo}>Photo {index + 1}{index === 0 ? " (main)" : ""}</option>)}</select></label>
                <small>Upload a book cover or product image in Show your work above, then choose it here. Clear the creation name to remove the spotlight.</small>
              </div>
            </div>
            <div className="dir-form-section">
              <div>
                <span className="dir-step">03</span>
                <h2>Make a connection.</h2>
                <p>
                  Choose the business contact details you want visitors to see.
                  Add at least one way to connect.
                </p>
              </div>
              <div className="dir-fields">
                <div className="dir-two">
                  {field("email", "Business email", "email", 254)}
                  {field("phone", "Business phone", "tel", 40)}
                </div>
                {field("website", "Website", "text", 500)}
                <fieldset className="dir-social-editor">
                  <legend>Social profiles</legend>
                  <p>Add a handle or paste a full profile link. Add as many accounts as you need.</p>
                  {(form.social_profiles || []).map((profile, index) => (
                    <div className="dir-social-row" key={index}>
                      <label>Platform {index + 1}
                        <select value={profile.platform} onChange={e => update("social_profiles", form.social_profiles.map((p, i) => i === index ? { ...p, platform: e.target.value } : p))}>
                          {Object.keys(SOCIAL_PLATFORMS).map(platform => <option key={platform}>{platform}</option>)}
                        </select>
                      </label>
                      <label>Handle or profile link {index + 1}
                        <input type="text" maxLength={500} placeholder={profile.platform === "Other" ? "https://…" : "@yourbusiness or https://…"} value={profile.url}
                          onChange={e => update("social_profiles", form.social_profiles.map((p, i) => i === index ? { ...p, url: e.target.value } : p))} />
                      </label>
                      <button type="button" className="dir-button dir-secondary" aria-label={`Remove social profile ${index + 1}`} onClick={() => update("social_profiles", form.social_profiles.filter((_, i) => i !== index))}>Remove</button>
                    </div>
                  ))}
                  <button type="button" className="dir-button dir-secondary" onClick={() => update("social_profiles", [...(form.social_profiles || []), { platform: "Instagram", url: "" }])}><Plus size={18} /> Add another social profile</button>
                </fieldset>
                {field(
                  "connect_url",
                  "Booking, shop, or social profile link",
                  "text",
                  500,
                )}
              </div>
            </div>
            <div className="dir-form-section">
              <div>
                <span className="dir-step">04</span>
                <h2>Build something together.</h2>
                <p>
                  Optional ways to support the community. Visitors will reach
                  out through your business contact details.
                </p>
              </div>
              <div className="dir-fields">
                <fieldset className="collective-offer-choices">
                  <legend>What would you like to offer?</legend>
                  {OFFERS.map((offer) => (
                    <label className="dir-check" key={offer.key}>
                      <input
                        type="checkbox"
                        checked={form.offers.includes(offer.key)}
                        onChange={(e) =>
                          update(
                            "offers",
                            e.target.checked
                              ? [...form.offers, offer.key]
                              : form.offers.filter((key) => key !== offer.key),
                          )
                        }
                      />
                      <span>
                        {offer.label}
                        <small>{offer.description}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {field(
                  "community_perk",
                  "RCAP community perk (optional)",
                  "text",
                  160,
                )}
                <small>
                  Describe your offer and any terms, such as a family discount
                  or complimentary consultation.
                </small>
                <label>
                  Collaboration or opportunity details (optional)
                  <textarea
                    rows={3}
                    maxLength={280}
                    value={form.collaboration_note}
                    onChange={(e) =>
                      update("collaboration_note", e.target.value)
                    }
                    placeholder="Tell families how you would like to connect."
                  />
                  <small>{form.collaboration_note.length}/280 characters</small>
                </label>
                <label className="dir-check">
                  <input
                    type="checkbox"
                    aria-label="Permission to publish"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    I am an RCA parent or guardian, have permission to share
                    these photos and business details, and understand that
                    published listings are visible to website visitors. I manage
                    any student venture listed here.
                  </span>
                </label>
              </div>
            </div>
            <div className="dir-save">
              <span>
                {busy
                  ? "Saving or uploading…"
                  : "You can return and make changes anytime."}
              </span>
              <button
                className="dir-button dir-secondary"
                type="button"
                onClick={() => save(false)}
              >
                Save as draft
              </button>
              <button className="dir-button" type="submit">
                {form.published ? "Save & publish changes" : "Publish listing"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}

function Details({ item, preview = false }) {
  const [activePhoto, setActivePhoto] = useState(null);
  return (
    <article className="dir-detail">
      {!preview && (
        <button className="dir-text-button" onClick={() => go()}>
          <ArrowLeft size={17} /> Back to the Collective
        </button>
      )}
      <div className="dir-detail-grid">
        <div>
          <Photo
            className="dir-main-photo"
            path={
              item.photos.includes(activePhoto) ? activePhoto : item.photos[0]
            }
            name={item.name}
          />
          <div className="dir-gallery">
            {item.photos.map((path, i) => (
              <button
                type="button"
                key={path}
                aria-label={`View photo ${i + 1}`}
                onClick={() => setActivePhoto(path)}
              >
                <Photo path={path} name={`${item.name}, photo ${i + 1}`} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="dir-eyebrow">{item.category}</span>
          {item.venture === "student" && (
            <p className="dir-student-inline">
              <Sparkles size={16} /> Student venture · Parent managed
            </p>
          )}

          <HouseBadge house={item.house} />
          <h1>{item.name || "Your business name"}</h1>
          {item.location && <p className="dir-location">{item.location}</p>}
          <p className="dir-bio">
            {item.bio || "Your story will appear here."}
          </p>
          {item.community_perk && (
            <div className="collective-detail-perk">
              <span className="dir-eyebrow">
                <Gift size={15} />
                RCAP community perk
              </span>
              <p>{item.community_perk}</p>
            </div>
          )}
          {Boolean(item.offers?.length || item.collaboration_note) && (
            <div className="collective-detail-opportunities">
              <h2>
                <Handshake size={22} />
                Open to connection
              </h2>
              <div className="dir-card-tags">
                {OFFERS.filter((offer) => item.offers?.includes(offer.key)).map(
                  (offer) => (
                    <span className="collective-tag" key={offer.key}>
                      {offer.action}
                    </span>
                  ),
                )}
              </div>
              {item.collaboration_note && <p>{item.collaboration_note}</p>}
              <small>
                Contact this business directly to discuss an opportunity.
              </small>
            </div>
          )}
          {item.product_name && <section className="dir-product-spotlight">
            {(item.product_photo || item.photos?.[0]) && <Photo path={item.photos?.includes(item.product_photo) ? item.product_photo : item.photos?.[0]} name={item.product_name} />}
            <div><span className="dir-eyebrow">Creation spotlight</span><h2>{item.product_name}</h2>{item.product_description && <p>{item.product_description}</p>}<SafeLink href={item.product_url}>Learn more <ArrowUpRight size={16} /></SafeLink></div>
          </section>}
          <div className="dir-contact">
            <h2>Let’s connect.</h2>
            {item.email && (
              <a href={`mailto:${item.email}`}>
                <Mail size={18} />
                {item.email}
              </a>
            )}
            {item.phone && (
              <a href={`tel:${item.phone.replace(/[^+\d]/g, "")}`}>
                <Phone size={18} />
                {item.phone}
              </a>
            )}
            {(item.social_profiles || []).map((profile, index) => {
              let href;
              try { href = socialUrl(profile); } catch { return null; }
              const handle = new URL(href).pathname.split("/").filter(Boolean).pop() || profile.platform;
              return <SafeLink key={index} href={href} className="dir-social-link" aria-label={`${profile.platform}: ${handle}`}><SocialIcon platform={profile.platform} /><span>{profile.platform}<small>{handle.startsWith("@") ? handle : `@${handle}`}</small></span></SafeLink>;
            })}
            <SafeLink href={item.website}>
              <Globe size={18} />
              Visit website
              <ArrowUpRight size={16} />
            </SafeLink>
            <SafeLink href={item.connect_url}>
              <ArrowUpRight size={18} />
              Book, shop, or connect
            </SafeLink>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const [route, setRoute] = useState(currentRoute),
    [user, setUser] = useState(null),
    [authReady, setAuthReady] = useState(false),
    [items, setItems] = useState([]),
    [owned, setOwned] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [pageKey, setPageKey] = useState(0);
  const [visibility,setVisibility] = useState(DEFAULT_VISIBILITY), [isAdmin,setIsAdmin] = useState(false);
  useEffect(() => {
    supabase.from("directory_settings").select("*").eq("id",true).single().then(({data}) => {if(data) setVisibility(data);});
  }, []);
  useEffect(() => {
    let active=true;setIsAdmin(false);
    if(user) supabase.from("directory_admins").select("user_id").eq("user_id",user.id).maybeSingle().then(({data})=>{if(active) setIsAdmin(Boolean(data));});
    return ()=>{active=false;};
  },[user]);
  const view = route.get("view") || "",
    id = route.get("id");
  useEffect(() => {
    const navigate = () => {
      setRoute(currentRoute());
      setPageKey((key) => key + 1);
      setError("");
    };
    window.addEventListener("popstate", navigate);
    return () => window.removeEventListener("popstate", navigate);
  }, []);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setUser(data.session?.user || null);
      setAuthReady(true);
      if (error)
        setError("Your sign-in could not be restored. Please sign in again.");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      listBusinesses(),
      user ? listBusinesses(user.id) : Promise.resolve([]),
    ])
      .then(([all, mine]) => {
        if (active) {
          setItems(all);
          setOwned(mine);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "We could not load the directory. Please try again in a moment.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, revision]);
  useEffect(() => {
    document.title = `${view === "manage" ? "My listings" : "The RCAP Collective"} | We Are RCAP`;
  }, [view]);
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
    else {
      setOwned([]);
      go();
    }
  }
  const selected = (view === "edit" ? owned : [...items, ...owned]).find(
    (item) => item.id === id,
  );
  const saved = () => {
    setNotice("Your listing has been saved.");
    setRevision((r) => r + 1);
    go("manage");
  };
  return (
    <div className="dir-shell">
      <a className="collective-skip" href="#main">
        Skip to content
      </a>
      <header className="dir-header">
        <a
          className="dir-brand"
          href="/directory/"
          onClick={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <span className="collective-brand-name">
            <b>RCAP</b> Collective
            <span>Our community. Your next connection.</span>
          </span>
        </a>
        <nav aria-label="Collective navigation">
          <a
            href="/directory/"
            aria-current={!view ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              go();
            }}
          >
            Explore
          </a>
          {isAdmin && <a href="?view=admin" onClick={e=>{e.preventDefault();go("admin");}}>Admin</a>}
          {visibility.student_spotlight && <a href="?view=students" onClick={e=>{e.preventDefault();go("students");}}>Student spotlight</a>}
          <a href="/">
            We Are RCAP
            <ArrowUpRight size={13} />
          </a>
          <a
            className="dir-button dir-secondary"
            href="?view=manage"
            onClick={(e) => {
              e.preventDefault();
              go("manage");
            }}
          >
            My listings
          </a>
          {user && (
            <button className="dir-text-button" onClick={signOut}>
              Sign out
            </button>
          )}
        </nav>
      </header>
      <main id="main">
        {error && (
          <div className="dir-alert" role="alert">
            {error}{" "}
            <button
              onClick={() => {
                setError("");
                if (error.startsWith("We could not load the directory")) {
                  setRevision((r) => r + 1);
                }
              }}
            >
              {error.startsWith("We could not load the directory")
                ? "Try again"
                : "Dismiss"}
            </button>
          </div>
        )}
        {notice && (
          <div className="dir-notice" role="status">
            {notice}
            <button className="dir-text-button" onClick={() => setNotice("")}>
              Dismiss
            </button>
          </div>
        )}
        {view === "admin" ? (!authReady ? <p>Checking your sign-in…</p> : !user ? <SignIn onError={setError} /> : isAdmin ? <Visibility settings={visibility} onSaved={setVisibility} /> : <p className="dir-empty">This account does not have directory admin access.</p>) : ["manage", "edit", "new", "new-student"].includes(view) ? (
          !authReady ? (
            <p className="dir-empty">Checking your sign-in…</p>
          ) : !user ? (
            <SignIn
              onError={setError}
              nextView={["new", "new-student"].includes(view) ? view : "manage"}
            />
          ) : loading ? (
            <p className="dir-empty">Loading your listings…</p>
          ) : ["new", "new-student"].includes(view) ||
            (view === "edit" && selected) ? (
            <Editor
              key={id || view}
              initial={selected}
              defaultVenture={view === "new-student" ? "student" : "parent"}
              user={user}
              onSaved={saved}
              onError={setError}
            />
          ) : view === "edit" ? (
            <div className="dir-empty">
              <h1>Listing not found.</h1>
              <button className="dir-button" onClick={() => go("manage")}>
                My listings
              </button>
            </div>
          ) : (
            <section className="dir-content">
              <div className="dir-section-heading">
                <div>
                  <span className="dir-eyebrow">Made by you</span>
                  <h1>My listings.</h1>
                  <p>Keep your corner of the community up to date.</p>
                </div>
                <button className="dir-button" onClick={() => go("new")}>
                  <Plus size={18} />
                  Add a listing
                </button>
              </div>
              {owned.length ? (
                <div className="dir-grid">
                  {owned.map((item) => (
                    <Card key={item.id} item={item} manage />
                  ))}
                </div>
              ) : (
                <div className="dir-empty">
                  <Store size={40} />
                  <h2>Your first listing starts here.</h2>
                  <p>
                    Introduce a business, a service, or a student venture to
                    your RCA community.
                  </p>
                  <button className="dir-button" onClick={() => go("new")}>
                    Create your first listing
                  </button>
                </div>
              )}
            </section>
          )
        ) : view === "listing" ? (
          loading ? (
            <p className="dir-empty">Loading listing…</p>
          ) : selected ? (
            <Details item={selected} />
          ) : (
            <div className="dir-empty">
              <h1>This listing is not available.</h1>
              <p>It may have been taken offline by its owner.</p>
              <button className="dir-button" onClick={() => go()}>
                Browse the Collective
              </button>
            </div>
          )
        ) : (
          <Collective
            key={pageKey}
            items={items}
            loading={loading}
            error={error}
            settings={visibility}
            studentMode={visibility.student_spotlight && view === "students"}
          />
        )}
      </main>
      <footer className="dir-footer">
        <div>
          <strong>
            RCAP <span>Collective</span>
          </strong>
          <p>Every family. Every talent. One RCAP community.</p>
        </div>
        <small>
          A parent-led directory. Listings are provided by their owners and are
          not endorsements by RCAP or the Ron Clark Academy.{" "}
          <a href="mailto:hello@wearercap.org">
            Questions or listing concerns?
          </a>
        </small>
      </footer>
    </div>
  );
}
