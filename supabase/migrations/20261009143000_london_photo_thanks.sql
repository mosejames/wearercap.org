-- Use the gallery visibility rules before accepting a postcard reaction.
create or replace function public.london_set_thanks(p_photo uuid, p_token text, p_thanked boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner text;
begin
  if length(coalesce(p_token, '')) < 32 then raise exception 'A sharing token is required'; end if;
  v_owner := public.m3_hash(p_token);
  if not p_thanked then
    delete from public.m3_likes where photo_id = p_photo and owner = v_owner;
    return;
  end if;
  if not exists (select 1 from public.m3_list_photos(p_token => p_token, p_vault => 'london-2028', p_mode => 'recent', p_limit => 5000) v where (v.photo).id = p_photo) then
    raise exception 'This postcard is no longer available';
  end if;
  insert into public.m3_likes(photo_id, owner) values (p_photo, v_owner) on conflict do nothing;
end;
$$;
revoke all on function public.london_set_thanks(uuid,text,boolean) from public;
grant execute on function public.london_set_thanks(uuid,text,boolean) to anon, authenticated;
