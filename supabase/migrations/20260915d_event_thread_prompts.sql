-- The thread is answers to questions, not a loose wall of notes. Each note
-- carries the question it answers so it never reads random out of context.
alter table public.event_comments
  add column if not exists prompt text check (char_length(prompt) <= 160);

drop function if exists public.event_comment_post(uuid, text);

create or replace function public.event_comment_post(p_token uuid, p_body text, p_prompt text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare r public.event_rsvps; ev public.events; v_body text := btrim(coalesce(p_body,''));
        v_prompt text := nullif(btrim(coalesce(p_prompt,'')), ''); v_id uuid;
begin
  select * into r from public.event_rsvps where token = p_token;
  if not found or r.status <> 'going' then raise exception 'rsvp_required'; end if;
  select * into ev from public.events where id = r.event_id;
  if not ev.comments_open then raise exception 'comments_closed'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 280 then raise exception 'invalid_body'; end if;
  if v_prompt is not null and char_length(v_prompt) > 160 then raise exception 'invalid_body'; end if;
  if exists (select 1 from public.event_comments where rsvp_id = r.id and created_at > now() - interval '20 seconds') then
    raise exception 'slow_down';
  end if;
  insert into public.event_comments (event_id, rsvp_id, body, prompt) values (r.event_id, r.id, v_body, v_prompt) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.event_comment_post(uuid, text, text) from public, anon, authenticated;
grant execute on function public.event_comment_post(uuid, text, text) to anon, authenticated;

drop function if exists public.event_thread(text);
create or replace function public.event_thread(p_slug text)
returns table (id uuid, body text, prompt text, created_at timestamptz, wall_name text, house text, photo_url text)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.body, c.prompt, c.created_at, r.wall_name, r.house,
         public.event_photo_url(r.photo_path, r.updated_at)
  from public.event_comments c
  join public.event_rsvps r on r.id = c.rsvp_id
  join public.events e on e.id = c.event_id
  where e.slug = p_slug and not c.hidden and r.status = 'going'
  order by c.created_at asc
  limit 500;
$$;
revoke all on function public.event_thread(text) from public, anon, authenticated;
grant execute on function public.event_thread(text) to anon, authenticated;

create or replace function public.event_admin_list(p_pass text, p_slug text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare ev public.events;
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  select * into ev from public.events where slug = p_slug;
  if not found then raise exception 'event_not_found'; end if;
  return jsonb_build_object(
    'event', public.event_get(p_slug),
    'rsvps', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'full_name', r.full_name, 'phone', r.phone, 'email', r.email,
        'house', r.house, 'grades', r.grades, 'plus_one_name', r.plus_one_name,
        'status', r.status, 'photo_url', public.event_photo_url(r.photo_path, r.updated_at),
        'confirm_sent_at', r.confirm_sent_at, 'confirm_error', r.confirm_error,
        'created_at', r.created_at) order by r.created_at desc)
      from public.event_rsvps r where r.event_id = ev.id), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'body', c.body, 'prompt', c.prompt, 'hidden', c.hidden, 'created_at', c.created_at,
        'full_name', r.full_name, 'wall_name', r.wall_name) order by c.created_at desc)
      from public.event_comments c join public.event_rsvps r on r.id = c.rsvp_id
      where c.event_id = ev.id), '[]'::jsonb));
end;
$$;

create or replace function public.event_broadcast()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_slug text; v_payload jsonb; v_kind text; r public.event_rsvps;
begin
  select slug into v_slug from public.events where id = new.event_id;
  if tg_table_name = 'event_rsvps' then
    v_kind := 'rsvp';
    v_payload := jsonb_build_object('id', new.id, 'wall_name', new.wall_name, 'house', new.house,
      'has_plus_one', new.plus_one_name is not null, 'status', new.status,
      'photo_url', public.event_photo_url(new.photo_path, new.updated_at), 'created_at', new.created_at,
      'going_count', public.event_going_count(new.event_id));
  else
    select * into r from public.event_rsvps where id = new.rsvp_id;
    v_kind := 'comment';
    v_payload := jsonb_build_object('id', new.id, 'body', new.body, 'prompt', new.prompt, 'hidden', new.hidden,
      'created_at', new.created_at, 'wall_name', r.wall_name, 'house', r.house,
      'photo_url', public.event_photo_url(r.photo_path, r.updated_at));
  end if;
  begin
    perform realtime.send(v_payload, v_kind, 'event:' || v_slug, false);
  exception when others then null;
  end;
  return new;
end;
$$;
