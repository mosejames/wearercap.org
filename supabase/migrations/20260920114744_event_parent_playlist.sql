-- Separate song requests from nostalgic Thread answers. RSVP capability tokens
-- authorize writes; only explicitly public fields leave the private schema.
create schema if not exists event_private;
revoke all on schema event_private from public;
grant usage on schema event_private to anon, authenticated;
create table public.event_songs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  rsvp_id uuid not null references public.event_rsvps(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  artist text not null check (char_length(btrim(artist)) between 1 and 120),
  source_comment_id uuid references public.event_comments(id) on delete cascade,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index event_songs_parent_track on public.event_songs(event_id, rsvp_id, lower(btrim(title)), lower(btrim(artist)));
create index event_songs_recent on public.event_songs(event_id, created_at desc);
alter table public.event_songs enable row level security;
revoke all on public.event_songs from public, anon, authenticated;

create function event_private.song_list(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc, s.id), '[]'::jsonb) from (
   select s.id, s.title, s.artist, s.created_at, r.wall_name, r.house,
     (s.source_comment_id is not null) as from_thread
   from public.event_songs s
   join public.events e on e.id=s.event_id
   join public.event_rsvps r on r.id=s.rsvp_id
   left join public.event_comments c on c.id=s.source_comment_id
   where e.slug=p_slug and not s.hidden and r.status='going'
     and (s.source_comment_id is null or not c.hidden)
   order by s.created_at desc, s.id limit 500
 ) s;
$$;
create function event_private.song_submit(p_slug text, p_token uuid, p_title text, p_artist text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.event_rsvps; ev public.events; v_id uuid;
 v_title text := btrim(regexp_replace(coalesce(p_title,''), '\s+', ' ', 'g'));
 v_artist text := btrim(regexp_replace(coalesce(p_artist,''), '\s+', ' ', 'g'));
begin
 select * into ev from public.events where slug=p_slug;
 if not found or ev.status <> 'open' then raise exception 'event_closed'; end if;
 -- Lock the RSVP to serialize duplicate/rate checks from simultaneous requests.
 select * into r from public.event_rsvps where token=p_token and event_id=ev.id for update;
 if not found or r.status <> 'going' then raise exception 'rsvp_required'; end if;
 if char_length(v_title) not between 1 and 120 or char_length(v_artist) not between 1 and 120 then raise exception 'invalid_song'; end if;
 if exists(select 1 from public.event_songs where rsvp_id=r.id and lower(title)=lower(v_title) and lower(artist)=lower(v_artist)) then raise exception 'duplicate_song'; end if;
 if exists(select 1 from public.event_songs where rsvp_id=r.id and source_comment_id is null and created_at>now()-interval '20 seconds') then raise exception 'slow_down'; end if;
 if (select count(*) from public.event_songs where rsvp_id=r.id and source_comment_id is null)>=30 then raise exception 'song_limit'; end if;
 insert into public.event_songs(event_id,rsvp_id,title,artist) values(ev.id,r.id,v_title,v_artist) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function event_private.song_list(text), event_private.song_submit(text,uuid,text,text) from public,anon,authenticated;
grant execute on function event_private.song_list(text), event_private.song_submit(text,uuid,text,text) to anon,authenticated;
create function public.event_song_list(p_slug text) returns jsonb language sql security invoker set search_path='' as $$ select event_private.song_list(p_slug); $$;
create function public.event_song_submit(p_slug text,p_token uuid,p_title text,p_artist text) returns uuid language sql security invoker set search_path='' as $$ select event_private.song_submit(p_slug,p_token,p_title,p_artist); $$;
revoke all on function public.event_song_list(text), public.event_song_submit(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.event_song_list(text), public.event_song_submit(text,uuid,text,text) to anon,authenticated;

-- Preserve attribution by resolving the actual Thread row, never a hardcoded ID.
insert into public.event_songs(event_id,rsvp_id,title,artist,source_comment_id,created_at)
select e.id,c.rsvp_id,seed.title,seed.artist,c.id,c.created_at
from (values
 ('Meeting in My Bedroom','Silk','%Meeting In My Bedroom%'),
 ('Swing My Way','K.P. & Envyi','%Shawty Swing My Way%'),
 ('Step In the Name of Love','R. Kelly','%Step in the Name of Love%'),
 ('Bump n'' Grind','R. Kelly','%bump grind%'),
 ('Dangerously In Love','Beyoncé','%Dangerously In Love%'),
 ('Hotel','Cassidy feat. R. Kelly','%Cassidy%Hotel%'),
 ('Candy','Cameo','%Candy by Cameo%'),
 ('Beam Ahhh','DJ Chipman','%Beam Ahh%')
) seed(title,artist,pattern)
join public.events e on e.slug='karaoke-sept-27'
join lateral (select c.* from public.event_comments c where c.event_id=e.id and not c.hidden and c.body ilike seed.pattern order by c.created_at limit 1) c on true
on conflict do nothing;
