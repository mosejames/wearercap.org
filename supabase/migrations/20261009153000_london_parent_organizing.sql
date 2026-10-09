-- Parents may add or change a collection label after a visible photo arrives.
-- This narrow editor cannot change media, captions, ownership or visibility.
create or replace function public.london_categorize_photo(p_photo uuid, p_token text, p_inspiration text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if length(coalesce(p_token,'')) < 32 then raise exception 'A sharing token is required'; end if;
  if not exists (select 1 from public.m3_photos p join public.m3_events e on e.id = p.event_id where p.id = p_photo and p.vault = 'london-2028' and not p.hidden and not e.hidden) then
    raise exception 'This postcard is no longer available';
  end if;
  if not exists (select 1 from public.m3_list_photos(p_token => p_token, p_vault => 'london-2028', p_mode => 'recent', p_limit => 5000) v where (v.photo).id = p_photo) then
    raise exception 'This postcard is no longer available';
  end if;
  update public.m3_photos set inspiration = coalesce(p_inspiration, '')
  where id = p_photo and vault = 'london-2028' and not hidden;
end;
$$;
revoke all on function public.london_categorize_photo(uuid,text,text) from public;
grant execute on function public.london_categorize_photo(uuid,text,text) to anon, authenticated;
