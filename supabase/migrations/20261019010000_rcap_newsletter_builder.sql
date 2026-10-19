-- RCAP newsletter builder. Adapted from the RCA "In the Loop" builder.
-- Issues are private drafts until an editor publishes them; published issues
-- are readable by anyone through the archive function only.
-- Editors are invited by email. Owners (the chair's accounts) invite officers.
begin;
create schema if not exists newsletter_private;
revoke all on schema newsletter_private from public, anon, authenticated;
grant usage on schema newsletter_private to anon, authenticated;

create table newsletter_private.editors(
  email text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name text not null default '' check (length(name) <= 80),
  role text not null check (role in ('owner','officer')),
  added_by text,
  added_at timestamptz not null default now()
);

create table newsletter_private.issues(
  id uuid primary key default gen_random_uuid(),
  format text not null check (format in ('quick','full')),
  title text not null default '' check (length(title) <= 160),
  issue_date date not null default (now() at time zone 'America/New_York')::date,
  content jsonb not null default '{}' check (jsonb_typeof(content) = 'object' and length(content::text) <= 200000),
  status text not null default 'draft' check (status in ('draft','published')),
  slug text unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,70}$' and slug not in ('builder','september-20','assets','index')),
  revision integer not null default 0,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check (status = 'draft' or slug is not null)
);
create index on newsletter_private.issues(status, issue_date desc);

alter table newsletter_private.editors enable row level security;
alter table newsletter_private.issues enable row level security;
revoke all on all tables in schema newsletter_private from public, anon, authenticated;

-- The chair's existing verified administrator emails are the first owners.
insert into newsletter_private.editors(email, name, role, added_by)
select lower(email), '', 'owner', 'seed' from playbook_private.admins
on conflict do nothing;

create function newsletter_private.summary(i newsletter_private.issues) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', i.id, 'format', i.format, 'title', i.title, 'issue_date', i.issue_date,
    'status', i.status, 'slug', i.slug, 'updated_at', i.updated_at, 'updated_by', i.updated_by,
    'created_by', i.created_by, 'published_at', i.published_at, 'revision', i.revision)
$$;

create function newsletter_private.dispatch(p_action text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  mail text;
  ed newsletter_private.editors;
  iss newsletter_private.issues;
  src newsletter_private.issues;
  v_id uuid;
  v_slug text;
  v_email text;
begin
  if uid is null then raise exception 'Sign in with your invited RCAP email.'; end if;
  select lower(email) into mail from auth.users where id = uid and email_confirmed_at is not null;
  select * into ed from newsletter_private.editors where email = mail;
  if ed.email is null then raise exception 'This builder is for invited RCAP officers. Ask Mose for an invite.'; end if;

  if p_action = 'me' then
    return jsonb_build_object('email', ed.email, 'name', ed.name, 'role', ed.role);

  elsif p_action = 'list' then
    return coalesce((select jsonb_agg(newsletter_private.summary(i) order by i.issue_date desc, i.updated_at desc)
      from newsletter_private.issues i), '[]'::jsonb);

  elsif p_action = 'load' then
    select * into iss from newsletter_private.issues where id = (p_payload->>'id')::uuid;
    if iss.id is null then raise exception 'That issue is not available.'; end if;
    return newsletter_private.summary(iss) || jsonb_build_object('content', iss.content);

  elsif p_action = 'create' then
    if p_payload ? 'from' then
      select * into src from newsletter_private.issues where id = (p_payload->>'from')::uuid;
      if src.id is null then raise exception 'That issue is not available to copy.'; end if;
      insert into newsletter_private.issues(format, title, content, created_by, updated_by)
      values (src.format, left(src.title, 150), src.content, mail, mail) returning * into iss;
    else
      if coalesce(p_payload->>'format', '') not in ('quick','full') then raise exception 'Choose Quick Hello or Full Issue.'; end if;
      if jsonb_typeof(p_payload->'content') is distinct from 'object' then raise exception 'Starting content is missing.'; end if;
      insert into newsletter_private.issues(format, title, content, created_by, updated_by)
      values (p_payload->>'format', left(coalesce(p_payload->>'title', ''), 160), p_payload->'content', mail, mail) returning * into iss;
    end if;
    return newsletter_private.summary(iss) || jsonb_build_object('content', iss.content);

  elsif p_action = 'save' then
    v_id := (p_payload->>'id')::uuid;
    if jsonb_typeof(p_payload->'content') is distinct from 'object' or length((p_payload->'content')::text) > 200000 then
      raise exception 'This issue is too large to save. Remove a section or a photo.';
    end if;
    select * into iss from newsletter_private.issues where id = v_id for update;
    if iss.id is null then raise exception 'That issue is not available.'; end if;
    if iss.revision <> coalesce((p_payload->>'expected_revision')::integer, -1) then
      raise exception 'Someone saved a newer version of this issue. Reload before editing so nothing is overwritten.';
    end if;
    update newsletter_private.issues set
      content = p_payload->'content',
      title = left(coalesce(p_payload->>'title', title), 160),
      issue_date = coalesce((p_payload->>'issue_date')::date, issue_date),
      revision = revision + 1, updated_by = mail, updated_at = now()
    where id = v_id returning * into iss;
    return newsletter_private.summary(iss);

  elsif p_action = 'publish' then
    v_slug := lower(coalesce(p_payload->>'slug', ''));
    if v_slug !~ '^[a-z0-9][a-z0-9-]{1,70}$' or v_slug in ('builder','september-20','assets','index') then
      raise exception 'Use lowercase letters, numbers, and dashes for the web address.';
    end if;
    if exists (select 1 from newsletter_private.issues where slug = v_slug and id <> (p_payload->>'id')::uuid) then
      raise exception 'Another issue already uses that web address.';
    end if;
    update newsletter_private.issues set status = 'published', slug = v_slug,
      published_at = coalesce(published_at, now()), updated_by = mail, updated_at = now(), revision = revision + 1
    where id = (p_payload->>'id')::uuid returning * into iss;
    if iss.id is null then raise exception 'That issue is not available.'; end if;
    return newsletter_private.summary(iss);

  elsif p_action = 'unpublish' then
    update newsletter_private.issues set status = 'draft', updated_by = mail, updated_at = now(), revision = revision + 1
    where id = (p_payload->>'id')::uuid returning * into iss;
    if iss.id is null then raise exception 'That issue is not available.'; end if;
    return newsletter_private.summary(iss);

  elsif p_action = 'delete' then
    select * into iss from newsletter_private.issues where id = (p_payload->>'id')::uuid;
    if iss.id is null then raise exception 'That issue is not available.'; end if;
    if iss.status = 'published' then raise exception 'Take this issue off the website before deleting it.'; end if;
    if ed.role <> 'owner' and iss.created_by <> mail then raise exception 'Only the person who started a draft can delete it.'; end if;
    delete from newsletter_private.issues where id = iss.id;
    return jsonb_build_object('ok', true);

  elsif p_action = 'upload_ok' then
    return to_jsonb(exists (select 1 from newsletter_private.issues where id = (p_payload->>'id')::uuid));

  elsif p_action = 'editors' then
    return coalesce((select jsonb_agg(jsonb_build_object('email', e.email, 'name', e.name, 'role', e.role,
      'joined', exists (select 1 from auth.users u where lower(u.email) = e.email and u.last_sign_in_at is not null))
      order by e.role, e.added_at) from newsletter_private.editors e), '[]'::jsonb);

  elsif p_action = 'invite' and ed.role = 'owner' then
    v_email := lower(trim(coalesce(p_payload->>'email', '')));
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a full email address.'; end if;
    insert into newsletter_private.editors(email, name, role, added_by)
    values (v_email, left(trim(coalesce(p_payload->>'name', '')), 80), 'officer', mail)
    on conflict (email) do update set name = case when excluded.name <> '' then excluded.name else newsletter_private.editors.name end;
    return jsonb_build_object('ok', true);

  elsif p_action = 'remove' and ed.role = 'owner' then
    v_email := lower(trim(coalesce(p_payload->>'email', '')));
    if exists (select 1 from newsletter_private.editors where email = v_email and role = 'owner') then
      raise exception 'Owner access cannot be removed here.';
    end if;
    delete from newsletter_private.editors where email = v_email;
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'Action not available.';
end $$;

revoke all on function newsletter_private.summary(newsletter_private.issues) from public, anon, authenticated;
revoke all on function newsletter_private.dispatch(text, jsonb) from public, anon;
grant execute on function newsletter_private.dispatch(text, jsonb) to authenticated;

create function public.rcap_newsletter(p_action text, p_payload jsonb default '{}') returns jsonb
language sql security invoker set search_path = '' as $$ select newsletter_private.dispatch(p_action, p_payload) $$;
revoke all on function public.rcap_newsletter(text, jsonb) from public, anon;
grant execute on function public.rcap_newsletter(text, jsonb) to authenticated;

-- Public archive: published issues only, never drafts or editor emails.
create function newsletter_private.archive(p_slug text) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare iss newsletter_private.issues;
begin
  if p_slug is null or p_slug = '' then
    return coalesce((select jsonb_agg(jsonb_build_object('slug', i.slug, 'title', i.title, 'issue_date', i.issue_date,
      'format', i.format, 'headline', i.content->>'headline', 'kicker', i.content->>'kicker')
      order by i.issue_date desc, i.published_at desc)
      from newsletter_private.issues i where i.status = 'published'), '[]'::jsonb);
  end if;
  select * into iss from newsletter_private.issues where slug = lower(p_slug) and status = 'published';
  if iss.id is null then return null; end if;
  return jsonb_build_object('slug', iss.slug, 'title', iss.title, 'issue_date', iss.issue_date, 'format', iss.format,
    'published_at', iss.published_at, 'content', iss.content);
end $$;
revoke all on function newsletter_private.archive(text) from public;
grant execute on function newsletter_private.archive(text) to anon, authenticated;

create function public.rcap_newsletter_archive(p_slug text default null) returns jsonb
language sql security invoker stable set search_path = '' as $$ select newsletter_private.archive(p_slug) $$;
revoke all on function public.rcap_newsletter_archive(text) from public;
grant execute on function public.rcap_newsletter_archive(text) to anon, authenticated;
commit;
