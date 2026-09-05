begin;
do $$
declare u uuid:=gen_random_uuid(); admin_id uuid; idea uuid; album uuid; cat text;
begin
 select user_id into admin_id from vault_private.staff where role='owner' limit 1;
 begin perform public.vault_suggest_event('Fixture event','',current_date,false,'sports'); raise exception 'Anonymous submission'; exception when others then if sqlerrm='Anonymous submission' then raise; end if; end;
 insert into auth.users(id,phone,phone_confirmed_at) values(u,'15550008901',now());
 perform set_config('request.jwt.claim.sub',u::text,true); perform public.vault_join(''); perform public.vault_save_member_profile('Suggestion fixture','',false);
 idea:=public.vault_suggest_event('Fixture basketball','A game',current_date,false,'sports');
 if exists(select 1 from public.vault_events where title='Fixture basketball') then raise exception 'Published without approval'; end if;
 begin perform public.vault_review_event_suggestion(idea,'approve',null,'sports',''); raise exception 'Contributor approved'; exception when others then if sqlerrm='Contributor approved' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 album:=public.vault_review_event_suggestion(idea,'approve',null,'sports','');
 select category into cat from public.vault_events where id=album;
 if cat<>'sports' then raise exception 'Wrong category'; end if;
 begin perform public.vault_review_event_suggestion(idea,'approve',null,'sports',''); raise exception 'Duplicate approval'; exception when others then if sqlerrm='Duplicate approval' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',u::text,true);
 idea:=public.vault_suggest_event('Fixture cheering','',null,true,'cheers');
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.vault_review_event_suggestion(idea,'link',album,null,'');
 if not exists(select 1 from vault_private.event_suggestions where id=idea and status='linked' and event_id=album) then raise exception 'Link failed'; end if;
end $$;
rollback;
