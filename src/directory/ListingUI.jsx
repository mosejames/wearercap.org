import React, { useEffect, useState, useRef } from "react";
import {
  ArrowUpRight,
  Store,
  Sparkles,
  Heart,
  Flame,
  Feather,
  Shield,
  MapPin,
  Globe,
  Gift,
  Handshake,
} from "lucide-react";
import { HOUSES, webUrl } from "./model.js";
import { photoUrl } from "./api.js";
import { go } from "./navigation.js";
const houseIcons = {
  amistad: Heart,
  isibindi: Flame,
  reveur: Feather,
  altruismo: Shield,
};
export function HouseBadge({ house, large = false }) {
  const data = HOUSES.find((item) => item.key === house);
  if (!data) return null;
  const Icon = houseIcons[house];
  return (
    <span
      className={`collective-house ${large ? "large" : ""}`}
      style={{ "--house-color": data.color }}
    >
      <Icon size={large ? 23 : 13} aria-hidden="true" />
      {data.name}
    </span>
  );
}
export function Photo({ path, name, className = "" }) {
  // Resolved during render rather than in an effect: the URL is known from the
  // path, so there is nothing to wait for. The state is only here to fall back
  // to initials if the image itself fails.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [path]);
  const url = failed ? "" : photoUrl(path);
  return url ? (
    <img
      className={className}
      src={url}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className={`dir-placeholder ${className}`}>
      <Store size={36} aria-hidden="true" />
      <span>{name?.slice(0, 2).toUpperCase() || "RCAP"}</span>
    </div>
  );
}
export function SafeLink({ href, children, ...props }) {
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
  const target = manage ? "edit" : "listing";
  return (
    <article
      className={`dir-card ${item.venture === "student" ? "is-student" : ""}`}
    >
      <a
        className="dir-card-primary"
        href={`?view=${target}&id=${item.id}`}
        onClick={(event) => {
          event.preventDefault();
          go(target, item.id);
        }}
      >
        <div className="dir-card-image">
          <Photo path={item.photos[0]} name={item.name} />
          <span className="dir-card-type">
            {item.venture === "student" ? (
              <>
                <Sparkles size={13} />
                Student venture
              </>
            ) : (
              "Parent business"
            )}
          </span>
        </div>
        <div className="dir-card-copy">
          <span className="dir-eyebrow">{item.category}</span>
          <h3>
            {item.name}
            <ArrowUpRight size={22} />
          </h3>
          <p>{item.bio || "Your story starts here. Add a short bio."}</p>
          <div className="dir-card-tags">
            <HouseBadge house={item.house} />
            {item.product_name && <span className="collective-tag">Creation spotlight: {item.product_name}</span>}
            {item.community_perk && (
              <span className="collective-tag">
                <Gift size={12} />
                Community perk
              </span>
            )}
            {item.offers?.includes("mentor") && (
              <span className="collective-tag">
                <Handshake size={12} />
                Mentorship
              </span>
            )}
          </div>
        </div>
      </a>
      <div className="dir-card-bottom">
        <span>
          {manage ? (
            `${item.published ? "Published" : "Draft"} · Edit listing`
          ) : (
            <>
              {item.reach === "worldwide" ? (
                <Globe size={13} />
              ) : (
                <MapPin size={13} />
              )}{" "}
              {item.location ||
                (item.reach === "worldwide"
                  ? "Available worldwide"
                  : "Our RCA community")}
            </>
          )}
        </span>
        {!manage && (
          <SafeLink
            href={item.connect_url || item.website}
            aria-label={`Connect with ${item.name}`}
          >
            Connect
            <ArrowUpRight size={13} />
          </SafeLink>
        )}
      </div>
    </article>
  );
}

export function ListingVideo({path}) {
 const [url,setUrl]=useState(""),[error,setError]=useState(""),[started,setStarted]=useState(false);
 const player=useRef(null);
 useEffect(()=>{let active=true;setUrl("");setError("");setStarted(false);if(path) setUrl(photoUrl(path));return ()=>{active=false;};},[path]);
 if(!path)return null;
 async function play(){try{setError("");await player.current.play();setStarted(true);}catch{setError("Playback could not start. Try Play video again.");}}
 return <div className="dir-listing-video">{url ? <><video ref={player} key={url} src={url} controls playsInline preload="metadata" aria-label="Business introduction video" onPlay={()=>setStarted(true)} onEnded={()=>setStarted(false)} onError={()=>setError("This browser cannot play this video. Try another browser or ask the owner for an MP4 version.")} />{!started && <button type="button" className="dir-button dir-secondary" onClick={play}>Play video</button>}</> : !error && <p>Loading video…</p>}{error && <p role="status">{error}</p>}</div>;
}
