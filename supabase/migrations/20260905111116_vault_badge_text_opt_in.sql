alter table vault_private.members add column badge_text_opt_in boolean not null default false;
create table vault_private.badge_text_consent(id bigint generated always as identity primary key,user_id uuid not null references auth.users(id),opted_in boolean not null,recorded_at timestamptz not null default now(),wording text not null default 'Text me when I earn a new Ami Vault photo badge.');
alter table vault_private.badge_text_consent enable row level security;
create table vault_private.badge_texts(user_id uuid not null references auth.users(id),milestone integer not null,status text not null default 'pending' check(status in('pending','sending','accepted','failed','cancelled')),created_at timestamptz not null default now(),attempted_at timestamptz,provider_id text,primary key(user_id,milestone),foreign key(user_id,milestone) references vault_private.badges(user_id,milestone));
alter table vault_private.badge_texts enable row level security;
revoke all on vault_private.badge_texts,vault_private.badge_text_consent from public,anon,authenticated;
create function vault_private.queue_badge_text() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from vault_private.members where user_id=new.user_id and badge_text_opt_in) then insert into vault_private.badge_texts(user_id,milestone) values(new.user_id,new.milestone) on conflict do nothing; end if;
 return new;
end $$;
revoke all on function vault_private.queue_badge_text() from public,anon,authenticated;
create trigger vault_badge_text_earned after insert on vault_private.badges for each row execute function vault_private.queue_badge_text();
create function public.vault_badge_text_preference() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select badge_text_opt_in from vault_private.members where user_id=auth.uid()),false)
$$;
create function public.vault_set_badge_text_preference(p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare old boolean;
begin
 if vault_private.active_owner() is null then raise exception 'Verify your number first'; end if;
 select badge_text_opt_in into old from vault_private.members where user_id=auth.uid() for update;
 if old is distinct from coalesce(p_enabled,false) then
  update vault_private.members set badge_text_opt_in=coalesce(p_enabled,false) where user_id=auth.uid();
  insert into vault_private.badge_text_consent(user_id,opted_in) values(auth.uid(),coalesce(p_enabled,false));
 end if;
 if not coalesce(p_enabled,false) then update vault_private.badge_texts set status='cancelled' where user_id=auth.uid() and status='pending'; end if;
end $$;
-- Claim a single job. A timeout stays 'sending' for review, never blindly retried.
create function public.vault_take_badge_text() returns jsonb language plpgsql security definer set search_path='' as $$
declare job vault_private.badge_texts; phone text;
begin
 if vault_private.active_owner() is null then raise exception 'Verify your number first'; end if;
 if not public.vault_badge_text_preference() then return null; end if;
 select * into job from vault_private.badge_texts where user_id=auth.uid() and status='pending' order by milestone for update skip locked limit 1;
 if job.user_id is null then return null; end if;
 select u.phone into phone from auth.users u where u.id=auth.uid();
 update vault_private.badge_texts set status='sending',attempted_at=now() where user_id=job.user_id and milestone=job.milestone;
 return jsonb_build_object('milestone',job.milestone,'phone',phone);
end $$;
create function public.vault_finish_badge_text(p_milestone integer,p_provider_id text,p_failed boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 update vault_private.badge_texts set status=case when p_failed then 'failed' else 'accepted' end,provider_id=left(p_provider_id,64) where user_id=auth.uid() and milestone=p_milestone and status='sending';
end $$;
revoke all on function public.vault_badge_text_preference(),public.vault_set_badge_text_preference(boolean),public.vault_take_badge_text(),public.vault_finish_badge_text(integer,text,boolean) from public,anon;
grant execute on function public.vault_badge_text_preference(),public.vault_set_badge_text_preference(boolean),public.vault_take_badge_text(),public.vault_finish_badge_text(integer,text,boolean) to authenticated;
