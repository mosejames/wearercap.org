create table public.thankful_messages (
  id uuid primary key,
  prompt text not null check (prompt in ('Growth', 'Moment', 'Surprise', 'People', 'Belonging', 'Lesson')),
  author text not null check (char_length(btrim(author)) between 1 and 60),
  message text not null check (char_length(btrim(message)) between 1 and 300),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.thankful_messages enable row level security;
revoke all on public.thankful_messages from anon, authenticated;
grant select (id, prompt, author, message, created_at), insert (id, prompt, author, message)
  on public.thankful_messages to anon, authenticated;
grant all on public.thankful_messages to service_role;

create policy "Read published gratitude cards"
on public.thankful_messages for select to anon, authenticated using (approved);

create policy "Submit gratitude cards for review"
on public.thankful_messages for insert to anon, authenticated with check (not approved);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thankful-message-photos', 'thankful-message-photos', false, 8388608, array['image/jpeg','image/png','image/webp']);

create policy "Submit a gratitude card photo"
on storage.objects for insert to anon, authenticated with check (
  bucket_id = 'thankful-message-photos'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/photo$'
);

create policy "Read photos on published gratitude cards"
on storage.objects for select to anon, authenticated using (
  bucket_id = 'thankful-message-photos'
  and exists (select 1 from public.thankful_messages card where storage.objects.name = card.id::text || '/photo')
);
