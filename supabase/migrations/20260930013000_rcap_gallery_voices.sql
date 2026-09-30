create table if not exists public.vault_gallery_voices (
  event_id uuid primary key references public.vault_events(id) on delete cascade,
  voice jsonb not null check (jsonb_typeof(voice) = 'object'),
  generated_at timestamptz not null default now()
);

alter table public.vault_gallery_voices enable row level security;
revoke all on public.vault_gallery_voices from anon, authenticated;

create or replace function public.vault_gallery_voice(p_event uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select v.voice
  from public.vault_gallery_voices v
  join public.vault_events e on e.id = v.event_id
  where v.event_id = p_event
    and e.house = 'rcap'
    and not e.hidden
$$;

create or replace function public.vault_gallery_voice_admin_event(p_event uuid, p_pass text default '')
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  e public.vault_events;
begin
  if coalesce(public.vault_staff_role_for('rcap'), '') <> 'owner'
     and not public.vault_pass_ok('rcap', coalesce(p_pass, '')) then
    raise exception 'Leadership access required';
  end if;

  select * into e
  from public.vault_events
  where id = p_event and house = 'rcap';
  if e.id is null then raise exception 'Gallery not found'; end if;

  return jsonb_build_object(
    'id', e.id,
    'slug', e.slug,
    'title', e.title,
    'blurb', e.blurb,
    'kind', e.kind,
    'startsOn', e.starts_on,
    'endsOn', e.ends_on,
    'ongoing', e.ongoing
  );
end
$$;

create or replace function public.vault_save_gallery_voice(
  p_event uuid,
  p_voice jsonb,
  p_pass text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if coalesce(public.vault_staff_role_for('rcap'), '') <> 'owner'
     and not public.vault_pass_ok('rcap', coalesce(p_pass, '')) then
    raise exception 'Leadership access required';
  end if;
  if not exists (select 1 from public.vault_events where id = p_event and house = 'rcap') then
    raise exception 'Gallery not found';
  end if;
  if jsonb_typeof(p_voice) <> 'object'
     or jsonb_array_length(coalesce(p_voice->'uploadPrompts', '[]'::jsonb)) <> 9
     or jsonb_typeof(coalesce(p_voice->'promoCopy', '[]'::jsonb)) <> 'array'
     or length(coalesce(p_voice->>'shareIntro', '')) < 30 then
    raise exception 'Invalid gallery voice';
  end if;

  insert into public.vault_gallery_voices (event_id, voice, generated_at)
  values (p_event, p_voice, now())
  on conflict (event_id) do update
    set voice = excluded.voice, generated_at = excluded.generated_at;
  return p_voice;
end
$$;

revoke all on function public.vault_gallery_voice(uuid) from public;
revoke all on function public.vault_gallery_voice_admin_event(uuid, text) from public;
revoke all on function public.vault_save_gallery_voice(uuid, jsonb, text) from public;
grant execute on function public.vault_gallery_voice(uuid) to anon, authenticated;
grant execute on function public.vault_gallery_voice_admin_event(uuid, text) to anon, authenticated;
grant execute on function public.vault_save_gallery_voice(uuid, jsonb, text) to anon, authenticated;
