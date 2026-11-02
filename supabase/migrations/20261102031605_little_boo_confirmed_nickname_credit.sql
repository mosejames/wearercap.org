begin;
select pg_advisory_xact_lock(291029);
-- Only the explicitly confirmed Mose/Mosie equivalence is added. Canonical
-- identities, photos, existing aliases, upload bonuses and earned credit stay.
do $aliases$ declare p record; alternate text; updated text[];begin
 for p in select person.* from boo_private.people person where person.mode='children' and boo_private.first_name_key(person.name) in('mose','mosie') and exists(select 1 from boo_private.photos f where f.person=person.id and f.state='active') for update loop
  alternate:=case boo_private.first_name_key(p.name) when 'mose' then 'mosie' else 'mose' end;
  select array_agg(distinct value order by value) into updated from unnest(p.aliases||array[alternate,boo_private.normalize(regexp_replace(p.name,'^[[:space:]]*[^[:space:]]+',alternate))])value;
  if not updated<@p.aliases then
   update boo_private.people set aliases=updated where id=p.id;
   insert into boo_private.audit(actor,action,payload) values(null,'approved_nickname_alias_v1',jsonb_build_object('personId',p.id,'previousAliases',p.aliases,'aliases',updated,'reason','User explicitly confirmed Mose and Mosie are equivalent'));
  end if;
 end loop;
end $aliases$;
-- Explicit aliases are evaluated for the pictured identity, before rejecting a
-- name just because it also occurs on another submitted identity.
do $patch$ declare definition text; old text:='if n<>p.normalized and exists(select 1 from boo_private.people other join boo_private.photos otherphoto'; replacement text:='if n<>p.normalized and not n=any(p.aliases) and exists(select 1 from boo_private.people other join boo_private.photos otherphoto';begin
 definition:=pg_get_functiondef('boo_private.game(text,jsonb)'::regprocedure);
 if strpos(definition,replacement)=0 then
  if length(definition)-length(replace(definition,old,''))<>length(old) then raise exception 'Alias collision guard changed; review before applying.';end if;
  execute replace(definition,old,replacement);
 end if;
end $patch$;
-- BEGIN NICKNAME REPAIR

-- Same exclusive game lock as the matcher migration. Audit receipts prevent a
-- second award even if a repaired play is later changed by an organizer.
do $repair$
declare item record; repaired integer:=0; awarded integer:=0; stamp timestamptz:=clock_timestamp(); chosen uuid; pts integer;
 before_count bigint; before_points bigint; after_count bigint; after_points bigint;
 before_hash text; after_hash text; first_hash text; after_first_hash text;
begin
 select count(*),coalesce(sum(points),0),md5(coalesce(string_agg(concat_ws('|',user_id,photo,points,correct_at),',' order by user_id,photo),''))
 into before_count,before_points,before_hash from boo_private.plays where points>0;
 select md5(coalesce(string_agg(concat_ws('|',id,first_correct),',' order by id),'')) into first_hash
 from boo_private.photos where first_correct is not null;
 for item in
  select s.user_id,s.photo,s.points old_points,s.correct_at old_correct_at,s.pending_at,s.hinted,
   f.first_correct old_first_correct, p.normalized
  from boo_private.plays s join boo_private.photos f on f.id=s.photo
  join boo_private.people p on p.id=f.person join boo_private.players player on player.user_id=s.user_id
  where s.submitted and s.points=0 and s.pending is null and f.state='active' and f.mode='children'
   and f.owner<>s.user_id and not(p.normalized=any(player.own_names))
   and s.pending_at is not null and length(boo_private.normalize(s.guess))>=2 and length(s.guess)<=100
   and boo_private.normalize(s.guess)=any(p.aliases)
   and not exists(select 1 from boo_private.audit a where a.action='nickname_credit_v1'
     and a.payload->>'userId'=s.user_id::text and a.payload->>'photoId'=s.photo::text)
  order by s.photo,s.hinted,s.pending_at,s.user_id
 loop
  select first_correct into chosen from boo_private.photos where id=item.photo for update;
  pts:=case when item.hinted then 1 when chosen is null then 5 else 3 end;
  update boo_private.plays set points=pts,correct_at=item.pending_at
   where user_id=item.user_id and photo=item.photo and submitted and points=0 and pending is null;
  if not found then raise exception 'A repair candidate changed unexpectedly. No credits applied.';end if;
  if not item.hinted and chosen is null then update boo_private.photos set first_correct=item.user_id where id=item.photo;end if;
  insert into boo_private.audit(actor,action,payload) values(null,'nickname_credit_v1',jsonb_build_object(
   'userId',item.user_id,'photoId',item.photo,'previousPoints',item.old_points,'previousCorrectAt',item.old_correct_at,
   'previousFirstCorrect',chosen,'points',pts,'correctAt',item.pending_at,'repairedAt',stamp,
   'reason','Exact supplied alias or explicitly confirmed Mose/Mosie equivalence','timestampBasis','recorded attempt start; existing first winners preserved'));
  insert into boo_private.notifications(user_id,message) values(item.user_id,'A previously rejected nickname guess was confirmed correct. +'||pts||' points. Your score has been updated.');
  repaired:=repaired+1;awarded:=awarded+pts;
 end loop;
 select count(*),coalesce(sum(points),0) into after_count,after_points from boo_private.plays where points>0;
 select md5(coalesce(string_agg(concat_ws('|',s.user_id,s.photo,s.points,s.correct_at),',' order by s.user_id,s.photo),''))
 into after_hash from boo_private.plays s where s.points>0 and not exists(
  select 1 from boo_private.audit a where a.action='nickname_credit_v1' and (a.payload->>'repairedAt')::timestamptz=stamp
   and a.payload->>'userId'=s.user_id::text and a.payload->>'photoId'=s.photo::text);
 select md5(coalesce(string_agg(concat_ws('|',f.id,f.first_correct),',' order by f.id),'')) into after_first_hash
 from boo_private.photos f where first_correct is not null and not exists(
  select 1 from boo_private.audit a where a.action='nickname_credit_v1' and (a.payload->>'repairedAt')::timestamptz=stamp
   and a.payload->>'photoId'=f.id::text and a.payload->>'points'='5' and a.payload->'previousFirstCorrect'='null'::jsonb);
 if before_hash is distinct from after_hash or first_hash is distinct from after_first_hash
  or after_count<>before_count+repaired or after_points<>before_points+awarded then
  raise exception 'Repair verification failed. No matching or score changes applied.';
 end if;
 insert into boo_private.audit(actor,action,payload) values(null,'nickname_credit_batch_v1',jsonb_build_object(
  'repairedAt',stamp,'repairedCount',repaired,'awardedPoints',awarded,'beforeCorrectCount',before_count,
  'afterCorrectCount',after_count,'beforeGuessPoints',before_points,'afterGuessPoints',after_points,
  'existingPositiveScoresPreserved',true,'existingFirstCorrectWinnersPreserved',true));
 raise notice 'Nickname review: % confirmed matches credited, % total points; existing positive scores unchanged.',repaired,awarded;
end $repair$;
-- END NICKNAME REPAIR
commit;
