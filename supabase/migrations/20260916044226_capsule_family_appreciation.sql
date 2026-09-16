-- Private acknowledgments: never part of public reactions or competitive scores.
create table vault_private.capsule_thanks (
  id uuid not null unique default gen_random_uuid(),
  photo_id uuid not null references public.vault_photos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  active boolean not null default true,
  primary key(photo_id,user_id)
);
create index capsule_thanks_sender_time on vault_private.capsule_thanks(user_id,created_at);
alter table vault_private.capsule_thanks enable row level security;
revoke all on vault_private.capsule_thanks from public,anon,authenticated;

create table vault_private.capsule_first_shares (
  user_id uuid primary key references auth.users(id) on delete cascade,
  earned_at timestamptz not null default now(),
  celebrated_at timestamptz
);
alter table vault_private.capsule_first_shares enable row level security;
revoke all on vault_private.capsule_first_shares from public,anon,authenticated;

create function vault_private.award_capsule_first_share()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.house='rcap' and not new.hidden and new.removed_at is null then
    insert into vault_private.capsule_first_shares(user_id)
      select l.user_id from vault_private.owner_links l where l.owner=new.owner
      on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function vault_private.award_capsule_first_share() from public,anon,authenticated;
create trigger capsule_first_share after insert on public.vault_photos
  for each row execute function vault_private.award_capsule_first_share();
-- Existing contributors have already earned it; don't announce a new first upload.
insert into vault_private.capsule_first_shares(user_id,earned_at,celebrated_at)
  select l.user_id,min(p.created_at),now() from public.vault_photos p
  join vault_private.owner_links l on l.owner=p.owner
  where p.house='rcap' and not p.hidden and p.removed_at is null
  group by l.user_id on conflict do nothing;

-- All private access lives behind an authenticated, verified-member guard.
create function vault_private.capsule_community(p_action text,p_photo uuid,p_offset integer,p_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); o text:=vault_private.active_owner(); p public.vault_photos;
  result jsonb; badge timestamptz; unread bigint; total bigint; claimed boolean;
begin
  if u is null or o is null then raise exception 'Sign in to continue'; end if;
  if p_action in ('state','send','undo') then
    select ph.* into p from public.vault_photos ph join public.vault_events e on e.id=ph.event_id
      where ph.id=p_photo and ph.house='rcap' and not ph.hidden and ph.removed_at is null and not e.hidden;
    if p.id is null then raise exception 'This photo is not available'; end if;
    if p_action='state' then
      return jsonb_build_object('thanked',exists(select 1 from vault_private.capsule_thanks t where t.photo_id=p.id and t.user_id=u and t.active));
    end if;
    if vault_private.owns(p.owner) then raise exception 'Thank another contributor for their photo'; end if;
    if p_action='undo' then
      update vault_private.capsule_thanks set active=false where photo_id=p.id and user_id=u;
      return jsonb_build_object('thanked',false);
    end if;
    perform pg_advisory_xact_lock(hashtextextended(u::text,46));
    if not exists(select 1 from vault_private.capsule_thanks t where t.photo_id=p.id and t.user_id=u)
      and (select count(*) from vault_private.capsule_thanks t where t.user_id=u and t.created_at>now()-interval '1 hour')>=100
      then raise exception 'Please wait before sending more thank-yous'; end if;
    insert into vault_private.capsule_thanks(photo_id,user_id) values(p.id,u)
      on conflict(photo_id,user_id) do update set active=true;
    return jsonb_build_object('thanked',true);
  elsif p_action='claim' then
    update vault_private.capsule_first_shares set celebrated_at=now() where user_id=u and celebrated_at is null;
    claimed:=found;
    return jsonb_build_object('first_share',claimed);
  elsif p_action='read' then
    -- Mark only items shown in the inbox, and only on this person's photos.
    update vault_private.capsule_thanks t set read_at=now()
      from public.vault_photos ph where ph.id=t.photo_id and t.active and t.read_at is null
      and t.id=any(p_ids[1:20]) and ph.house='rcap' and vault_private.owns(ph.owner);
    return '{}'::jsonb;
  elsif p_action not in ('summary','inbox') then
    raise exception 'Unknown action';
  end if;
  select earned_at into badge from vault_private.capsule_first_shares where user_id=u;
  select count(*),count(*) filter(where t.read_at is null) into total,unread
    from vault_private.capsule_thanks t join public.vault_photos ph on ph.id=t.photo_id
    join public.vault_events e on e.id=ph.event_id
    join vault_private.members m on m.user_id=t.user_id
    where vault_private.owns(ph.owner) and ph.house='rcap' and t.active
    and not ph.hidden and ph.removed_at is null and not e.hidden
    and not exists(select 1 from vault_private.bans b where b.phone_hash=m.phone_hash);
  result:=jsonb_build_object('first_share_at',badge,'unread',unread,'total',total);
  if p_action='inbox' then
    result:=result||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(r)) from (
      select t.id,ph.id as photo_id,ph.thumb_key,ph.storage,e.slug,e.title,
        coalesce(pr.display_name,'An RCA parent') as sender,t.created_at,t.read_at
      from vault_private.capsule_thanks t join public.vault_photos ph on ph.id=t.photo_id
      join public.vault_events e on e.id=ph.event_id
      join vault_private.members m on m.user_id=t.user_id
      left join public.vault_profiles pr on pr.owner=m.owner
      where vault_private.owns(ph.owner) and ph.house='rcap' and t.active
        and not ph.hidden and ph.removed_at is null and not e.hidden
        and not exists(select 1 from vault_private.bans b where b.phone_hash=m.phone_hash)
      order by t.created_at desc,t.photo_id,t.user_id limit 20 offset greatest(0,least(coalesce(p_offset,0),100000))
    ) r),'[]'::jsonb));
  end if;
  return result;
end $$;
revoke all on function vault_private.capsule_community(text,uuid,integer,uuid[]) from public,anon;
grant execute on function vault_private.capsule_community(text,uuid,integer,uuid[]) to authenticated;
create function public.capsule_community(p_action text,p_photo uuid default null,p_offset integer default 0,p_ids uuid[] default '{}')
returns jsonb language sql security invoker set search_path='' as $$
  select vault_private.capsule_community(p_action,p_photo,p_offset,p_ids);
$$;
revoke all on function public.capsule_community(text,uuid,integer,uuid[]) from public,anon;
grant execute on function public.capsule_community(text,uuid,integer,uuid[]) to authenticated;
