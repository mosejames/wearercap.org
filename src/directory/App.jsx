import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Search,
  Plus,
  Store,
  Mail,
  Phone,
  Globe,
  Sparkles,
} from "lucide-react";
import {
  CATEGORIES,
  emptyListing,
  filterListings,
  validateListing,
  webUrl,
} from "./model.js";
import {
  supabase,
  listBusinesses,
  saveBusiness,
  photoUrl,
  uploadPhoto,
  removePhotos,
} from "./api.js";

function currentRoute() {
  return new URLSearchParams(window.location.search);
}
function go(view = "", id = "") {
  const url = new URL(window.location.href);
  url.search = "";
  if (view) url.searchParams.set("view", view);
  if (id) url.searchParams.set("id", id);
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}
function Photo({ path, name, className = "" }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    setUrl("");
    if (path)
      photoUrl(path)
        .then((value) => {
          if (active) setUrl(value);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [path]);
  return url ? (
    <img
      className={className}
      src={url}
      alt={name}
      loading="lazy"
      onError={() => setUrl("")}
    />
  ) : (
    <div className={`dir-placeholder ${className}`}>
      <Store size={42} aria-hidden="true" />
      <span>{name?.slice(0, 1) || "RCAP"}</span>
    </div>
  );
}
function SafeLink({ href, children, ...props }) {
  try {
    const url = webUrl(href);
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    ) : null;
  } catch {
    return null;
  }
}
export function Card({ item, manage = false }) {
  return (
    <article className="dir-card">
      <a
        href={`?view=${manage ? "edit" : "listing"}&id=${item.id}`}
        onClick={(e) => {
          e.preventDefault();
          go(manage ? "edit" : "listing", item.id);
        }}
      >
        <div className="dir-card-image">
          <Photo path={item.photos[0]} name={item.name} />
          {item.venture === "student" && (
            <span className="dir-student">
              <Sparkles size={13} /> Student venture
            </span>
          )}
        </div>
        <div className="dir-card-copy">
          <span className="dir-eyebrow">{item.category}</span>
          <h3>
            {item.name}
            <ArrowUpRight size={22} />
          </h3>
          <p>{item.bio || "Your story starts here. Add a short bio."}</p>
          <div className="dir-card-bottom">
            {manage ? (
              <span>
                {item.published ? "Published" : "Draft"} · Edit listing
              </span>
            ) : (
              <span>{item.location || "From our RCA community"}</span>
            )}
          </div>
        </div>
      </a>
    </article>
  );
}

function SignIn({ onError }) {
  const [email, setEmail] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  const callback = new URL(window.location.href);
  callback.pathname = callback.pathname.replace(/\/?$/, "/");
  callback.search = "?view=manage";
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
            email,
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
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button className="dir-button dir-secondary" disabled={busy || sent}>
          {busy
            ? "Please wait…"
            : sent
              ? "Sign-in link sent"
              : "Email me a sign-in link"}
        </button>
      </form>
      {sent && (
        <p role="status">
          Check your inbox for a link to sign in. You can close this page and
          follow the link from your email.
        </p>
      )}
      <small>
        Use the same sign-in method each time to find your listings.
      </small>
    </section>
  );
}

export function Editor({ initial, user, onSaved, onError }) {
  const [form, setForm] = useState(
    initial || { ...emptyListing(), id: crypto.randomUUID() },
  );
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
                {field(
                  "connect_url",
                  "Booking, shop, or social profile link",
                  "text",
                  500,
                )}
                <label className="dir-check">
                  <input
                    type="checkbox"
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
          <ArrowLeft size={17} /> Back to directory
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
          <h1>{item.name || "Your business name"}</h1>
          {item.location && <p className="dir-location">{item.location}</p>}
          <p className="dir-bio">
            {item.bio || "Your story will appear here."}
          </p>
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
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [students, setStudents] = useState(false),
    [revision, setRevision] = useState(0);
  const view = route.get("view") || "",
    id = route.get("id");
  useEffect(() => {
    const navigate = () => {
      setRoute(currentRoute());
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
    document.title = `${view === "manage" ? "My listings" : "The RCAP Directory"} | We Are RCAP`;
  }, [view]);
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
    else {
      setOwned([]);
      go();
    }
  }
  const visible = filterListings(items, query, category, students);
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
      <header className="dir-header">
        <a className="dir-brand" href="/">
          RCAP
          <span>
            Ron Clark Academy
            <br />
            Parents
          </span>
        </a>
        <nav aria-label="Directory">
          <a href="/">Back to RCAP</a>
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
                setRevision((r) => r + 1);
              }}
            >
              Try again
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
        {["manage", "edit", "new"].includes(view) ? (
          !authReady ? (
            <p className="dir-empty">Checking your sign-in…</p>
          ) : !user ? (
            <SignIn onError={setError} />
          ) : loading ? (
            <p className="dir-empty">Loading your listings…</p>
          ) : view === "new" || (view === "edit" && selected) ? (
            <Editor
              key={id || "new"}
              initial={selected}
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
                Browse the directory
              </button>
            </div>
          )
        ) : (
          <>
            <section className="dir-hero">
              <div>
                <span className="dir-eyebrow">The RCAP Directory</span>
                <h1>
                  What you need
                  <br />
                  might be <em>right here.</em>
                </h1>
                <p>
                  The coach. The caterer. The next great read. Discover the
                  businesses, talents, and big ideas in our own RCA community.
                </p>
                <a
                  className="dir-button"
                  href="?view=new"
                  onClick={(e) => {
                    e.preventDefault();
                    go("new");
                  }}
                >
                  Share what you do
                  <ArrowUpRight size={18} />
                </a>
              </div>
              <aside className="dir-hero-note">
                <span className="dir-star" aria-hidden="true">
                  ✳
                </span>
                <p>
                  We are parents.
                  <br />
                  We are makers.
                  <br />
                  We are possibility.
                </p>
                <span>And our kids have big ideas, too.</span>
              </aside>
            </section>
            <section className="dir-content">
              <div className="dir-section-heading">
                <div>
                  <span className="dir-eyebrow">Start with your community</span>
                  <h2>Find your people.</h2>
                </div>
                <p>Big businesses. Side hustles. Small beginnings.</p>
              </div>
              <div className="dir-filters">
                <label className="dir-search">
                  <Search size={20} />
                  <input
                    aria-label="Search the directory"
                    placeholder="What are you looking for?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <label className="dir-category">
                  <span className="dir-sr">Category</span>
                  <select
                    aria-label="Category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <button
                  className={`dir-student-filter ${students ? "active" : ""}`}
                  aria-pressed={students}
                  onClick={() => setStudents(!students)}
                >
                  <Sparkles size={17} />
                  Student ventures
                </button>
              </div>
              <div className="dir-result-line" aria-live="polite">
                <span>
                  {loading
                    ? "Finding our community…"
                    : `${visible.length} ${visible.length === 1 ? "listing" : "listings"}`}
                </span>
                {(query || category || students) && (
                  <button
                    className="dir-text-button"
                    onClick={() => {
                      setQuery("");
                      setCategory("");
                      setStudents(false);
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              {!loading &&
                (visible.length ? (
                  <div className="dir-grid">
                    {visible.map((item) => (
                      <Card key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="dir-empty">
                    <Store size={42} />
                    <h2>
                      {items.length
                        ? "No matches just yet."
                        : error
                          ? "We’re having trouble connecting."
                          : "Someone here needs what you do."}
                    </h2>
                    <p>
                      {items.length
                        ? "Try another search or explore all categories."
                        : error
                          ? "Try again shortly to see the community’s listings."
                          : "Be one of the first to share a business, a talent, or a big idea."}
                    </p>
                    {!items.length && !error && (
                      <button className="dir-button" onClick={() => go("new")}>
                        Add your listing
                        <Plus size={18} />
                      </button>
                    )}
                  </div>
                ))}
            </section>
            <section className="dir-band">
              <Sparkles size={34} />
              <div>
                <h2>Small venture. Big possibility.</h2>
                <p>
                  A DJ in the making? A lemonade stand with a following? Student
                  entrepreneurs belong here, too. Parents and guardians can
                  create and manage their listings.
                </p>
              </div>
              <button
                className="dir-button dir-secondary"
                onClick={() => go("new")}
              >
                Make room for their idea
                <ArrowUpRight size={18} />
              </button>
            </section>
          </>
        )}
      </main>
      <footer className="dir-footer">
        <strong>WE ARE RCAP.</strong>
        <p>Our community has a lot to offer. Let’s start with each other.</p>
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
