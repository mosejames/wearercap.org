-- Keep interrupted file cleanup visible to owners and moderators for retry.
alter table public.vault_photos add column cleanup_pending boolean not null default false;
create function vault_private.mark_removal_cleanup() returns trigger language plpgsql set search_path='' as $$
begin
 if old.removed_at is null and new.removed_at is not null then new.cleanup_pending:=true; end if;
 return new;
end $$;
create trigger vault_removal_cleanup before update on public.vault_photos for each row execute function vault_private.mark_removal_cleanup();
create function public.vault_finish_removal(p_id uuid,p_pass text default '') returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.vault_photos where id=p_id and removed_at is not null and (vault_private.owns(owner) or public.vault_pass_ok('amistad',p_pass))) then raise exception 'You cannot change this upload'; end if;
 update public.vault_photos set cleanup_pending=false where id=p_id;
end $$;
revoke all on function vault_private.mark_removal_cleanup(),public.vault_finish_removal(uuid,text) from public;
grant execute on function public.vault_finish_removal(uuid,text) to anon,authenticated;
create or replace function public.vault_review_reports(p_pass text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.vault_pass_ok('amistad',p_pass) then raise exception 'Wrong passcode'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'photo',to_jsonb(p),'event',e.title,'reason',r.reason,'note',r.note,'status',r.status,'created_at',r.created_at,'can_ban',l.user_id is not null,'banned',b.phone_hash is not null) order by r.created_at desc)
 from vault_private.reports r join public.vault_photos p on p.id=r.photo_id join public.vault_events e on e.id=p.event_id
 left join vault_private.owner_links l on l.owner=p.owner left join vault_private.members m on m.user_id=l.user_id left join vault_private.bans b on b.phone_hash=m.phone_hash
 where r.status='open' or p.cleanup_pending),'[]'::jsonb);
end $$;
