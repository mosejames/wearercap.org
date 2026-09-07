import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Plus,
  Handshake,
  Mic2,
  BriefcaseBusiness,
  Gift,
  SlidersHorizontal,
  Lightbulb,
} from "lucide-react";
import { CATEGORIES, HOUSES, OFFERS, filterListings } from "./model.js";
import { Card, HouseBadge, Photo } from "./ListingUI.jsx";
import { go } from "./navigation.js";

function scrollToBrowse() {
  document.getElementById("collective-browse")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}
function Showcase({ items, studentMode }) {
  const [index, setIndex] = useState(0);
  const candidates = items
    .filter((item) => !studentMode || item.venture === "student")
    .slice()
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 5);
  const selected = candidates[index % (candidates.length || 1)];
  return (
    <div className="collective-showcase">
      {selected ? (
        <>
          <a
            className="showcase-main showcase-listing"
            href={`?view=listing&id=${selected.id}`}
            onClick={(e) => {
              e.preventDefault();
              go("listing", selected.id);
            }}
          >
            <Photo path={selected.photos[0]} name={selected.name} />
            <div className="showcase-overlay">
              <span className="showcase-label">
                <span />
                Community spotlight
              </span>
              <div>
                <HouseBadge house={selected.house} />
                <h2>{selected.name}</h2>
                <p>{selected.category}</p>
                <span className="showcase-link">
                  Meet the business
                  <ArrowUpRight size={18} />
                </span>
              </div>
            </div>
          </a>
          <div className="showcase-caption">
            <span>
              {selected.venture === "student"
                ? "Student imagination. Community support."
                : "Meet the talent within our community."}
            </span>
            {candidates.length > 1 && (
              <div className="showcase-controls">
                <button
                  aria-label="Previous spotlight"
                  onClick={() =>
                    setIndex(
                      (i) => (i + candidates.length - 1) % candidates.length,
                    )
                  }
                >
                  <ChevronLeft size={17} />
                </button>
                <span aria-live="polite">
                  {(index % candidates.length) + 1} / {candidates.length}
                </span>
                <button
                  aria-label="Next spotlight"
                  onClick={() => setIndex((i) => (i + 1) % candidates.length)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="showcase-main">
            <img
              src="/images/rcap-community-smiles.jpg"
              alt="RCA parents celebrating together"
              fetchPriority="high"
            />
            <div className="showcase-overlay">
              <span className="showcase-label">
                <span />
                Built on community
              </span>
              <div>
                <p className="showcase-small">
                  A familiar face.
                  <br />A world of possibility.
                </p>
                <span className="showcase-link">This is where we start.</span>
              </div>
            </div>
            <div className="showcase-stamp" aria-hidden="true">
              WE ARE
              <br />
              <strong>RCAP.</strong>
            </div>
          </div>
          <div className="showcase-caption">
            <span>Our people are our greatest resource.</span>
            <span className="showcase-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        </>
      )}
      <div className="showcase-mini">
        <span className="showcase-mini-icon">
          <Sparkles size={25} />
        </span>
        <div>
          <small>Big ideas belong here</small>
          <strong>Parents. Students. Possibility.</strong>
        </div>
        <ArrowUpRight size={22} />
      </div>
    </div>
  );
}

function StudentSpotlight({ items, loading, studentMode }) {
  const students = items.filter((item) => item.venture === "student");
  return (
    <section className="collective-students" aria-labelledby="student-heading">
      <div className="collective-student-intro">
        <span className="dir-eyebrow">
          <Sparkles size={14} />
          The next generation
        </span>
        <h2 id="student-heading">
          Small ventures.
          <br />
          <em>Big futures.</em>
        </h2>
        <p>
          The first booking. The first order. The first person who says, “I
          believe in you.” Let’s be that community.
        </p>
        <button
          className="dir-button dir-secondary"
          onClick={() => go("new-student")}
        >
          Share a student venture
          <ArrowUpRight size={17} />
        </button>
        {!studentMode && students.length > 0 && (
          <button className="dir-text-button" onClick={() => go("students")}>
            Explore all student ventures
            <ArrowRight size={16} />
          </button>
        )}
      </div>
      {students.length ? (
        <div className="student-preview-grid">
          {students.slice(0, 2).map((item) => (
            <Card key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="student-invitation">
          <span className="student-orbit" aria-hidden="true">
            <Lightbulb size={60} />
          </span>
          <span className="dir-eyebrow">
            {loading
              ? "Finding our young makers…"
              : "A place for their next big idea"}
          </span>
          <h3>
            Their first customer
            <br />
            could be <em>you.</em>
          </h3>
          <p>
            Young DJs. Budding artists. Future founders.
            <br />
            Parent managed. Community supported.
          </p>
          <div className="student-invitation-bottom">
            <span>
              <Sparkles size={14} />
              Student spotlight
            </span>
            <button
              aria-label="Create a student venture listing"
              onClick={() => go("new-student")}
            >
              <ArrowUpRight size={23} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Collective({
  items,
  loading,
  error,
  studentMode = false,
}) {
  const initial = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(initial.get("q") || "");
  const [category, setCategory] = useState(initial.get("category") || "");

  const [reach, setReach] = useState(initial.get("reach") || "");
  const [offer, setOffer] = useState(initial.get("offer") || "");
  const [perks, setPerks] = useState(initial.get("perks") === "1");
  const [extraFilters, setExtraFilters] = useState(
    Boolean(
      initial.get("reach") || initial.get("offer") || initial.get("perks"),
    ),
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries({
      q: query,
      category,
      house: "",
      reach,
      offer,
      perks: perks ? "1" : "",
    })) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState({}, "", url);
  }, [query, category, reach, offer, perks]);
  const visible = filterListings(items, query, category, studentMode, {
    reach,
    offer,
    perks,
  });
  const hasFilters = Boolean(
    query || category || reach || offer || perks,
  );
  const clear = () => {
    setQuery("");
    setCategory("");

    setReach("");
    setOffer("");
    setPerks(false);
  };
  const collaboration = items.filter((item) => item.offers?.length);
  const chooseOffer = (value) => {
    if (studentMode) {
      go("", "", { offer: value }, "collective-browse");
      return;
    }
    setOffer(value);
    setExtraFilters(true);
    scrollToBrowse();
  };
  useEffect(() => {
    if (window.location.hash === "#collective-browse") scrollToBrowse();
  }, []);
  return (
    <>
      <section className="collective-hero">
        <div className="collective-hero-copy">
          <span className="dir-eyebrow">
            <span className="live-dot" />
            The RCAP Collective
          </span>
          <h1>
            {studentMode ? (
              <>
                Small beginnings.
                <br />
                Extraordinary
                <br />
                <em>possibilities.</em>
              </>
            ) : (
              <>
                Our people.
                <br />
                Extraordinary
                <br />
                <em>possibilities.</em>
              </>
            )}
          </h1>
          <p className="collective-hero-lead">
            What you need might be right here.
          </p>
          <p>
            {studentMode
              ? "Discover the imagination, ambition, and ventures of our students. Every big idea deserves someone in its corner."
              : "The coach. The caterer. The next great read. Discover the businesses, talents, and big ideas in our own RCA community."}
          </p>
          <div className="collective-hero-actions">
            <button className="dir-button" onClick={scrollToBrowse}>
              {studentMode
                ? "Explore student ventures"
                : "Explore the Collective"}
              <ArrowRight size={18} />
            </button>
            <button
              className="dir-text-button"
              onClick={() => go(studentMode ? "new-student" : "new")}
            >
              Share what you do
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="collective-hero-footnote">
            Every family. Every talent. One RCAP community.
          </div>
        </div>
        <Showcase items={items} studentMode={studentMode} />
      </section>
      <StudentSpotlight
        items={items}
        loading={loading}
        studentMode={studentMode}
      />
      <section
        id="collective-browse"
        className="collective-browse"
        aria-labelledby="collective-heading"
      >
        <div className="dir-section-heading">
          <div>
            <span className="dir-eyebrow">Start with your community</span>
            <h2 id="collective-heading">
              {studentMode
                ? "Meet our young makers."
                : "Find your future partners."}
            </h2>
          </div>
          <button
            className="dir-text-button"
            onClick={() => go(studentMode ? "new-student" : "new")}
          >
            <Plus size={17} />
            Add your listing
          </button>
        </div>
        <div className="collective-discovery">
          <div className="collective-discovery-tabs">
            <div>
              <button
                className={!studentMode ? "active" : ""}
                onClick={() => go()}
                aria-pressed={!studentMode}
              >
                The whole Collective
              </button>
              <button
                className={studentMode ? "active" : ""}
                onClick={() => go("students")}
                aria-pressed={studentMode}
              >
                <Sparkles size={14} />
                Student ventures
              </button>
            </div>
            <span>Find a service. Make a connection.</span>
          </div>
          <div className="dir-filters">
            <label className="dir-search">
              <Search size={20} />
              <input
                aria-label="Search the Collective"
                placeholder="Search a business, skill, or big idea"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="collective-select">
              <span>Category</span>
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
              className={`collective-filter-toggle ${extraFilters ? "active" : ""}`}
              aria-expanded={extraFilters}
              aria-controls="collective-extra-filters"
              onClick={() => setExtraFilters(!extraFilters)}
            >
              <SlidersHorizontal size={18} />
              <span>More filters</span>
              {(reach || offer || perks) && (
                <i aria-label="Additional filters applied" />
              )}
            </button>
          </div>
          {extraFilters && (
            <div
              id="collective-extra-filters"
              className="collective-extra-filters"
            >
              <label className="collective-select">
                <span>Service reach</span>
                <select
                  aria-label="Service reach"
                  value={reach}
                  onChange={(e) => setReach(e.target.value)}
                >
                  <option value="">Anywhere</option>
                  <option value="local">Local / in person</option>
                  <option value="worldwide">Online / worldwide</option>
                </select>
              </label>
              <label className="collective-select">
                <span>Ways to connect</span>
                <select
                  aria-label="Community opportunity"
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                >
                  <option value="">All opportunities</option>
                  {OFFERS.map((o) => (
                    <option value={o.key} key={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="collective-perk-filter">
                <input
                  type="checkbox"
                  checked={perks}
                  onChange={(e) => setPerks(e.target.checked)}
                />
                <Gift size={17} />
                Community perks available
              </label>
            </div>
          )}
        </div>
        <div className="dir-result-line" aria-live="polite">
          <span>
            {loading
              ? "Finding our community…"
              : `${visible.length} ${visible.length === 1 ? "listing" : "listings"}${hasFilters ? " matching your search" : " in the Collective"}`}
          </span>
          {hasFilters ? (
            <button className="dir-text-button" onClick={clear}>
              Clear filters
            </button>
          ) : (
            <span>Independent businesses. Connected by RCA.</span>
          )}
        </div>
        {loading ? (
          <div className="collective-loading" role="status">
            Loading the Collective…
          </div>
        ) : visible.length ? (
          <div className="dir-grid">
            {visible.map((item) => (
              <Card key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="collective-empty">
            <div className="collective-empty-icon">
              <Plus size={30} />
            </div>
            <div>
              <span className="dir-eyebrow">
                {error
                  ? "A little pause"
                  : hasFilters
                    ? "Keep exploring"
                    : "The Collective starts with us"}
              </span>
              <h3>
                {error
                  ? "We’re having trouble connecting."
                  : hasFilters
                    ? "Your next connection is still out there."
                    : studentMode
                      ? "Make room for their first big idea."
                      : "Someone here needs what you do."}
              </h3>
              <p>
                {error
                  ? "Please try loading the page again in a moment."
                  : hasFilters
                    ? "Try another search or explore all categories."
                    : "Introduce your business, share your talent, or bring a student venture into the spotlight."}
              </p>
            </div>
            {!error && (
              <button
                className="dir-button dir-secondary"
                onClick={
                  hasFilters
                    ? clear
                    : () => go(studentMode ? "new-student" : "new")
                }
              >
                {hasFilters
                  ? "Explore all listings"
                  : "Be part of the Collective"}
                <ArrowUpRight size={17} />
              </button>
            )}
          </div>
        )}
      </section>
      <section
        className="collective-collaboration"
        id="collective-collaboration"
        aria-labelledby="collaboration-heading"
      >
        <div className="dir-section-heading">
          <div>
            <span className="dir-eyebrow">More than what we sell</span>
            <h2 id="collaboration-heading">
              What can we build <em>together?</em>
            </h2>
          </div>
          <p>
            Share your experience.
            <br />
            Open a door for someone else.
          </p>
        </div>
        <div className="collaboration-grid">
          <article className="collaboration-feature">
            <img
              src="/images/rcap-community-table.jpg"
              alt="RCA parents sharing ideas together"
              loading="lazy"
            />
            <div>
              <span className="dir-eyebrow">The collaboration hub</span>
              <h3>
                A little of your experience.
                <br />A lot of possibility.
              </h3>
              <p>
                Mentor a student. Share your career story. Find a family to
                partner with. Add what you can offer to your listing.
              </p>
              <button
                className="dir-button dir-secondary"
                onClick={() => go("manage")}
              >
                Share what you can offer
                <ArrowUpRight size={17} />
              </button>
            </div>
          </article>
          <div className="collaboration-opportunities">
            {OFFERS.map((o, i) => {
              const Icon = [Handshake, Mic2, BriefcaseBusiness, Lightbulb][i];
              const count = collaboration.filter((item) =>
                item.offers.includes(o.key),
              ).length;
              return (
                <button key={o.key} onClick={() => chooseOffer(o.key)}>
                  <span className="opportunity-icon">
                    <Icon size={21} />
                  </span>
                  <span>
                    <strong>{o.label}</strong>
                    <small>
                      {count
                        ? `${count} ${count === 1 ? "listing" : "listings"} offering this`
                        : o.description}
                    </small>
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <section className="collective-join">
        <span className="dir-eyebrow">Built within. Shared with all.</span>
        <h2>
          Your community.
          <br />
          <em>Your next connection.</em>
        </h2>
        <p>
          Whatever you create, whatever you offer,
          <br />
          there is a place for it here.
        </p>
        <button className="dir-button" onClick={() => go("new")}>
          Join the Collective
          <Plus size={18} />
        </button>
        <div aria-hidden="true" className="join-watermark">
          RCAP
        </div>
      </section>
    </>
  );
}
