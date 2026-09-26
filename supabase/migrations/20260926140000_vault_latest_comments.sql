-- The newest comments across a vault, for the Capsule home. Only comments a
-- visitor could already read on the photo itself: visible comment, visible
-- photo, visible album. Returns just enough of the photo to draw a thumbnail
-- and link to it.
create or replace function public.vault_latest_comments(p_house text, p_limit integer default 6)
returns table(
  id uuid, body text, author_name text, owner text, created_at timestamptz,
  photo_id uuid, storage text, thumb_key text, web_key text, content_type text,
  event_slug text, event_title text
) language sql stable security definer set search_path to '' as $$
 select c.id, c.body, c.author_name, c.owner, c.created_at,
        p.id, p.storage, p.thumb_key, p.web_key, p.content_type,
        e.slug, e.title
 from public.vault_comments c
 join public.vault_photos p on p.id = c.photo_id
 join public.vault_events e on e.id = p.event_id
 where p.house = p_house and not c.hidden and not p.hidden
   and p.removed_at is null and not e.hidden
 order by c.created_at desc
 limit least(greatest(coalesce(p_limit, 6), 1), 30)
$$;
grant execute on function public.vault_latest_comments(text, integer) to anon, authenticated, service_role;

-- The parent social gets its album the day before, so the home page can
-- already show it as the next event. Photos open 12:01am on the 27th.
insert into public.vault_events (house, slug, title, blurb, kind, starts_on, open, featured, hidden, ongoing)
select 'rcap', 'karaoke-night', 'R&B Karaoke Night', 'The parent social. Adults only, 5 to 7pm at RCA.', 'school', '2026-09-27', true, false, false, false
where not exists (select 1 from public.vault_events where house = 'rcap' and slug = 'karaoke-night');
