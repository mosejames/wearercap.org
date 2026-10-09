-- London uses the specialty-vault tables, with its own identity namespace,
-- albums and moderation passphrase. Images always go to the shared R2 bucket.
insert into public.m3_settings (vault, title, admin_pass, timezone, event_date, reveal_at)
values ('london-2028', 'A Class of 2028 Takes London', encode(extensions.gen_random_bytes(24), 'hex'), 'Europe/London', '2026-10-11', '2026-01-01T00:00:00Z')
on conflict (vault) do nothing;

-- All albums are open for contributions before, during and after the trip.
-- There are no deadlines, quotas, team reveals or separate group galleries.
insert into public.m3_events (vault, slug, title, blurb, kind, starts_on, ongoing)
values
 ('london-2028', 'the-whole-adventure', 'The whole adventure', 'Every group, one shared story.', 'everyday', '2026-10-11', true),
 ('london-2028', 'off-we-go', 'Off we go', 'Airport hellos and travel buddies.', 'moment', '2026-10-11', true),
 ('london-2028', 'hello-london', 'Hello, London', 'Tower of London, fish and chips, London Dungeon, National Portrait Gallery and Trafalgar Square.', 'moment', '2026-10-12', true),
 ('london-2028', 'history-and-six', 'History, meet the West End', 'Westminster Abbey, British Museum, Madame Tussauds and SIX.', 'moment', '2026-10-13', true),
 ('london-2028', 'palaces-and-stones', 'Palaces, stones & a little magic', 'Hampton Court Palace, Stonehenge and Wicked.', 'moment', '2026-10-14', true),
 ('london-2028', 'bonjour-paris', 'Bonjour, Paris', 'Train to Paris, Louvre, dinner together and the Eiffel Tower.', 'moment', '2026-10-15', true),
 ('london-2028', 'a-day-to-remember', 'A day to remember', 'Versailles, Napoleon’s Tomb, Notre-Dame and the Seine dinner cruise.', 'moment', '2026-10-16', true),
 ('london-2028', 'home-with-stories', 'Home with stories', 'The journey home and reunion hugs.', 'moment', '2026-10-17', true)
on conflict (vault, slug) do nothing;

-- The existing profile writer defaults to M3. This endpoint explicitly stamps
-- London and cannot change a profile belonging to another vault.
create or replace function public.london_save_profile(p_token text, p_name text, p_group text default '')
returns public.m3_people language plpgsql security definer set search_path = '' as $$
declare o text := public.m3_hash(p_token); r public.m3_people;
begin
  if length(coalesce(p_token,'')) < 16 then raise exception 'Bad token'; end if;
  if length(btrim(coalesce(p_name,''))) = 0 then raise exception 'Name required'; end if;
  insert into public.m3_profiles (owner, vault, display_name, team)
  values (o, 'london-2028', left(btrim(p_name),60), left(btrim(coalesce(p_group,'')),40))
  on conflict (owner) do update set display_name = excluded.display_name, team = excluded.team, updated_at = now()
  where public.m3_profiles.vault = 'london-2028';
  if not found then raise exception 'Please use a London sharing profile'; end if;
  select * into r from public.m3_people where owner = o and vault = 'london-2028';
  return r;
end $$;
revoke all on function public.london_save_profile(text,text,text) from public;
grant execute on function public.london_save_profile(text,text,text) to anon, authenticated;

-- Enforce the storage rule on metadata writes as well as upload signing.
-- Other specialty vaults keep their existing storage history intact.
alter table public.m3_photos add constraint london_r2_only check (
 vault <> 'london-2028' or (
   storage = 'r2'
   and key ~ '^london-2028/[0-9a-f]{8}/[a-z0-9-]{1,60}/[0-9a-f-]{36}/orig\.[a-z0-9]{2,5}$'
   and web_key ~ '^london-2028/[0-9a-f]{8}/[a-z0-9-]{1,60}/[0-9a-f-]{36}/web\.jpg$'
   and thumb_key ~ '^london-2028/[0-9a-f]{8}/[a-z0-9-]{1,60}/[0-9a-f-]{36}/thumb\.jpg$'
 )
);
