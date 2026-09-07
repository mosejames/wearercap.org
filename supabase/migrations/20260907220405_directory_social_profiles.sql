begin;
alter table public.directory_listings add column social_profiles jsonb not null default '[]'::jsonb check (jsonb_typeof(social_profiles) = 'array');
create function public.directory_validate_social_profiles() returns trigger language plpgsql set search_path = '' as $$
declare profile jsonb;
begin
  for profile in select value from jsonb_array_elements(new.social_profiles) loop
    if jsonb_typeof(profile) <> 'object' or
       coalesce(profile->>'platform','') not in ('Instagram','Facebook','TikTok','YouTube','LinkedIn','X / Twitter','Threads','Pinterest','Other') or
       coalesce(profile->>'url','') !~* '^https?://[^[:space:]]+$' or length(profile->>'url') > 500 then
      raise exception 'Enter a valid social platform and profile link';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.directory_validate_social_profiles() from public;
create trigger directory_social_before_write before insert or update on public.directory_listings for each row execute function public.directory_validate_social_profiles();
alter table public.directory_listings drop constraint directory_ready_to_publish;
alter table public.directory_listings add constraint directory_ready_to_publish check (not published or (length(btrim(bio)) > 0 and (length(btrim(email || phone || website || connect_url)) > 0 or jsonb_array_length(social_profiles) > 0)));
commit;
