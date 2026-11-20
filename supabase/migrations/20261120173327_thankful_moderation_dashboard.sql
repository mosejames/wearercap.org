create schema if not exists thankful_private;
grant usage on schema thankful_private to authenticated;
create table thankful_private.moderators (user_id uuid primary key references auth.users(id) on delete cascade);
insert into thankful_private.moderators(user_id)
select id from auth.users where lower(email) = 'mose@mosejames.com' and email_confirmed_at is not null;

create function thankful_private.can_moderate() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from thankful_private.moderators where user_id = (select auth.uid())) $$;
revoke all on function thankful_private.can_moderate() from public;
grant execute on function thankful_private.can_moderate() to authenticated;

create table public.thankful_published_videos (
  path text primary key,
  published_at timestamptz not null default now()
);
alter table public.thankful_published_videos enable row level security;
revoke all on public.thankful_published_videos from anon, authenticated;
grant select on public.thankful_published_videos to anon, authenticated;
create policy "Read published Thanksgiving videos" on public.thankful_published_videos
for select to anon, authenticated using (true);

create policy "Moderators preview Thanksgiving submissions" on storage.objects
for select to authenticated using (
  bucket_id in ('thankful-at-rca', 'thankful-message-photos') and (select thankful_private.can_moderate())
);
create policy "View published Thanksgiving videos" on storage.objects
for select to anon, authenticated using (
  bucket_id = 'thankful-at-rca'
  and exists (select 1 from public.thankful_published_videos video where video.path = storage.objects.name)
);

create function public.thankful_moderation_queue(before_time timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not thankful_private.can_moderate() then raise insufficient_privilege; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(items) order by items.created_at desc, items.path) from (
      select * from (
        select 'photo' as kind, o.name as path, m.created_at, m.approved as published, m.prompt,
          m.author, m.message, m.student_or_family_name as family_name, to_jsonb(m.houses) as houses, to_jsonb(m.class_years) as class_years, true as gallery_consent
        from public.thankful_messages m join storage.objects o
          on o.bucket_id = 'thankful-message-photos' and o.name = m.id::text || '/photo'
        union all
        select 'video', o.name, o.created_at, p.path is not null, o.user_metadata->>'prompt',
          coalesce(o.user_metadata->>'speakerName', o.user_metadata->>'family'), null,
          o.user_metadata->>'studentOrFamilyName', o.user_metadata->'houses', o.user_metadata->'classYears', coalesce(o.user_metadata->>'galleryConsent' = 'true', false)
        from storage.objects o left join public.thankful_published_videos p on p.path = o.name
        where o.bucket_id = 'thankful-at-rca'
      ) all_submissions
      where before_time is null or created_at < before_time
      order by created_at desc, path limit 40
    ) items
  ), '[]'::jsonb);
end $$;

create function public.thankful_set_published(media_kind text, media_path text, make_public boolean, gallery_permission_confirmed boolean default false) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not thankful_private.can_moderate() then raise insufficient_privilege; end if;
  if media_kind = 'photo' then
    update public.thankful_messages
      set approved = make_public
      where id::text || '/photo' = media_path
      and (not make_public or exists (
        select 1 from storage.objects where bucket_id = 'thankful-message-photos' and name = media_path
      ));
    if not found then raise exception 'Photo card not found'; end if;
  elsif media_kind = 'video' then
    if make_public then
      if not exists (select 1 from storage.objects where bucket_id = 'thankful-at-rca' and name = media_path and user_metadata->>'consent' = 'true'
        and (user_metadata->>'galleryConsent' = 'true' or gallery_permission_confirmed))
        then raise exception 'Video or consent not found'; end if;
      insert into public.thankful_published_videos(path) values (media_path) on conflict do nothing;
    else
      delete from public.thankful_published_videos where path = media_path;
    end if;
  else
    raise exception 'Unknown submission type';
  end if;
end $$;
revoke all on function public.thankful_moderation_queue(timestamptz), public.thankful_set_published(text,text,boolean,boolean) from public;
grant execute on function public.thankful_moderation_queue(timestamptz), public.thankful_set_published(text,text,boolean,boolean) to authenticated;
