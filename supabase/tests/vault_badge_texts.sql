begin;
do $$
declare u uuid:=gen_random_uuid(); o text; job jsonb;
begin
 insert into auth.users(id,phone,phone_confirmed_at) values(u,'15550008501',now());
 perform set_config('request.jwt.claim.sub',u::text,true);
 o:=public.vault_join('')->>'owner';
 insert into vault_private.badges(user_id,milestone) values(u,10);
 if exists(select 1 from vault_private.badge_texts where user_id=u) then raise exception 'Queued without consent'; end if;
 perform public.vault_set_badge_text_preference(true);
 if exists(select 1 from vault_private.badge_texts where user_id=u) then raise exception 'Old milestone replayed'; end if;
 insert into vault_private.badges(user_id,milestone) values(u,50);
 job:=public.vault_take_badge_text();
 if (job->>'milestone')::int<>50 then raise exception 'New milestone not queued'; end if;
 if public.vault_take_badge_text() is not null then raise exception 'Duplicate send allowed'; end if;
 perform public.vault_finish_badge_text(50,'SMfixture',false);
 insert into vault_private.badges(user_id,milestone) values(u,100);
 perform public.vault_set_badge_text_preference(false);
 if public.vault_take_badge_text() is not null then raise exception 'Sent after opt out'; end if;
 if (public.vault_public_badges()->>o)::int<>100 then raise exception 'Public avatar badge missing'; end if;
end $$;
rollback;
