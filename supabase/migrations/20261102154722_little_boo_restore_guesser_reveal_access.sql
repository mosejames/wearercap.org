begin;
select pg_advisory_xact_lock(291029);
-- Restore the explicit pre-close guesser restriction. Contribution points remain
-- earned and included in qualifying guessers' totals; they grant no photo access.
create or replace function boo_private.reveal_rankings() returns table(user_id uuid,display text,points int,guess_points int,upload_points int,placement bigint,ties bigint) language sql stable security invoker set search_path='' as $$
 with eligible as(select p.user_id,p.display from boo_private.players p join auth.users a on a.id=p.user_id cross join boo_private.settings cfg where cfg.id=true and a.phone_confirmed_at is not null and not coalesce(a.is_anonymous,false) and a.deleted_at is null and (a.banned_until is null or a.banned_until<=statement_timestamp()) and not exists(select 1 from vault_private.staff st where st.user_id=p.user_id) and exists(select 1 from boo_private.plays s join boo_private.photos f on f.id=s.photo where s.user_id=p.user_id and s.submitted and f.mode='children' and f.state='active' and coalesce(s.pending_at,s.correct_at)>=cfg.guesses_open_at and coalesce(s.pending_at,s.correct_at)<cfg.closes_at)),
 totals as(select e.user_id,e.display,coalesce(sum(v.points),0)::int points,coalesce(sum(v.guess_points),0)::int guess_points,coalesce(sum(v.upload_points),0)::int upload_points from eligible e left join boo_private.score_events('children')v on v.user_id=e.user_id group by e.user_id,e.display)
 select *,rank()over(order by points desc),count(*)over(partition by points) from totals
$$;
revoke all on function boo_private.reveal_rankings() from public,anon,authenticated;
do $message$
declare definition text; broader text:='The reveal is for participants who submitted guesses or earned photo-submission points before closing.'; restricted text:='The reveal is only for players who submitted guesses before closing.';
begin
 definition:=pg_get_functiondef('boo_private.reveal_dispatch(text,jsonb)'::regprocedure);
 if position(restricted in definition)>0 then return;end if;
 if length(definition)-length(replace(definition,broader,''))<>length(broader) then raise exception 'Unexpected reveal denial message; review before restoring the restriction.';end if;
 execute replace(definition,broader,restricted);
end $message$;
commit;
