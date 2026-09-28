import { useEffect, useState } from "react";
import { client } from "./api.js";

export default function GalleryInvite({ survey }) {
  const [photos, setPhotos] = useState([]);
  const slug = survey.gallery_url?.match(/#\/e\/([^/?#]+)/)?.[1];
  useEffect(() => {
    let active = true;
    setPhotos([]);
    if (!slug) return;
    async function load() {
      const { data: event } = await client.from("vault_events")
        .select("id").eq("house", "rcap").eq("slug", slug).eq("hidden", false).maybeSingle();
      if (!event) return;
      const { data } = await client.from("vault_photos")
        .select("id,thumb_key,storage").eq("event_id", event.id).eq("hidden", false)
        .order("created_at", { ascending: false }).limit(4);
      let config;
      if (data?.some(p => p.storage === "r2")) {
        const response = await fetch("/api/vault-sign");
        if (response.ok) config = await response.json();
      }
      const base = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/vault-media`;
      if (active) setPhotos((data || []).filter(p => p.thumb_key && (p.storage !== "r2" || config?.publicBase))
        .map(p => ({ id: p.id, src: `${p.storage === "r2" ? config.publicBase : base}/${p.thumb_key}` })));
    }
    load().catch(() => {});
    return () => { active = false; };
  }, [slug]);
  const images = photos.length ? photos : survey.cover_url ? [{ id: "cover", src: survey.cover_url }] : [];
  return (
    <a className="gallery-invite" href={survey.gallery_url}>
      <h2>{slug === "karaoke-night" ? "We’ve got some of the pictures. You’ve got the rest." : "Want to see photos from the event?"}</h2>
      <p>Your camera roll holds a part of the {slug === "karaoke-night" ? "night" : "event"} we haven’t seen. Find your people, enjoy the memories, and add your moments to the mix.</p>
      {images.length > 0 && <div className={`gallery-preview photos-${images.length}`} aria-hidden="true">
        {images.map(photo => <img key={photo.id} src={photo.src} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = "hidden"; }} />)}
      </div>}
      <span className="gallery-invite-cta">See the photos &amp; add yours <span aria-hidden="true">↗</span></span>
    </a>
  );
}
