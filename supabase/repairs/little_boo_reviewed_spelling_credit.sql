-- DML repair only. Targets are the 24 organizer-reviewed attempt IDs and raw
-- guess/name SHA256 fingerprints, supplied privately via a transaction-local
-- boo.reviewed_spelling_attempts setting. No broad aliases or fuzzy matching.
do $reviewed$
declare targets jsonb:=current_setting('boo.reviewed_spelling_attempts',true)::jsonb;
 item record; receipt jsonb; stamp timestamptz:=clock_timestamp(); credited int:=0; awarded int:=0; skipped int:=0; pts int;
 positive_hash text; first_hash text; upload_hash text; after_hash text;
 before_correct bigint; before_points bigint; after_correct bigint; after_points bigint;
 before_activity jsonb; after_activity jsonb; before_rankings jsonb; after_rankings jsonb;
 review_ref constant text:='little-boo-2026-11-02-organizer-reviewed-24-v1';
begin
 perform pg_advisory_xact_lock(291029);
 if jsonb_typeof(targets) is distinct from 'array' or jsonb_array_length(targets)<>24 then raise exception 'Exactly the 24 reviewed attempts are required.';end if;
 if (select count(distinct (x->>'user_id',x->>'photo')) from jsonb_array_elements(targets)x)<>24 then raise exception 'Reviewed attempt IDs must be unique.';end if;
 if exists(select 1 from jsonb_array_elements(targets)x where x->>'guess_hash' !~ '^[0-9a-f]{64}$' or x->>'name_hash' !~ '^[0-9a-f]{64}$' or not(x ?& array['user_id','photo','guess_hash','name_hash'])) then raise exception 'Exact reviewed fingerprints are required.';end if;
 -- Lock the exact 24 attempts, then validate the complete set before any credit.
 perform 1 from boo_private.plays s join jsonb_to_recordset(targets)as t(user_id uuid,photo uuid,guess_hash text,name_hash text) on t.user_id=s.user_id and t.photo=s.photo for update of s;
 if (select count(*) from boo_private.plays s join boo_private.photos f on f.id=s.photo join boo_private.people p on p.id=f.person join boo_private.players pl on pl.user_id=s.user_id join jsonb_to_recordset(targets)as t(user_id uuid,photo uuid,guess_hash text,name_hash text) on t.user_id=s.user_id and t.photo=s.photo where s.submitted and s.pending is null and s.pending_at is not null and f.state='active' and f.mode='children' and f.owner<>s.user_id and not(p.normalized=any(pl.own_names)) and encode(extensions.digest(s.guess,'sha256'),'hex')=t.guess_hash and encode(extensions.digest(p.name,'sha256'),'hex')=t.name_hash and f.first_correct is not null)<>24 then raise exception 'A reviewed attempt or identity changed; no credits applied.';end if;
 select count(*),coalesce(sum(points),0),md5(coalesce(string_agg(concat_ws('|',user_id,photo,points,correct_at),',' order by user_id,photo),'')) into before_correct,before_points,positive_hash from boo_private.plays where points>0;
 select md5(coalesce(string_agg(concat_ws('|',id,first_correct),',' order by id),'')) into first_hash from boo_private.photos;
 select md5(coalesce(string_agg(to_jsonb(c)::text,',' order by c.student_key),'')) into upload_hash from boo_private.contributions c;
 select jsonb_build_object('total',count(*),'correct',count(*)filter(where s.points>0),'incorrect',count(*)filter(where s.points=0),'guessPoints',coalesce(sum(s.points),0)) into before_activity from boo_private.plays s join boo_private.photos f on f.id=s.photo where s.submitted and f.state='active' and f.mode='children';
 with totals as(select user_id,sum(points)::int points from boo_private.score_events('children') group by user_id),ranked as(select *,rank()over(order by points desc)::int placement,count(*)over(partition by points)::int ties from totals)select jsonb_object_agg(user_id,jsonb_build_object('points',points,'placement',placement,'ties',ties)) into before_rankings from ranked;
 for item in select s.*,t.guess_hash,t.name_hash from boo_private.plays s join jsonb_to_recordset(targets)as t(user_id uuid,photo uuid,guess_hash text,name_hash text)on t.user_id=s.user_id and t.photo=s.photo order by s.photo,s.user_id loop
  select a.payload into receipt from boo_private.audit a where a.action='reviewed_spelling_credit_v1' and a.payload->>'reviewRef'=review_ref and a.payload->>'userId'=item.user_id::text and a.payload->>'photoId'=item.photo::text;
  if receipt is not null then
   if item.points<>(receipt->>'points')::int then raise exception 'An audited correction changed; review required.';end if;
   skipped:=skipped+1;continue;
  end if;
  if item.points>0 then skipped:=skipped+1;continue;end if;
  if item.points<>0 then raise exception 'Unexpected reviewed score.';end if;
  pts:=case when item.hinted then 1 else 3 end;
  update boo_private.plays set points=pts,correct_at=item.pending_at where user_id=item.user_id and photo=item.photo and submitted and points=0 and pending is null;
  if not found then raise exception 'A reviewed score changed during repair.';end if;
  insert into boo_private.audit(actor,action,payload) values(null,'reviewed_spelling_credit_v1',jsonb_build_object('reviewRef',review_ref,'userId',item.user_id,'photoId',item.photo,'guessHash',item.guess_hash,'nameHash',item.name_hash,'previousPoints',item.points,'previousCorrectAt',item.correct_at,'points',pts,'correctAt',item.pending_at,'repairedAt',stamp,'reason','Organizer explicitly approved this exact reviewed attempt; no generic alias expansion','timestampBasis','Recorded attempt start; all existing first-correct awards preserved'));
  credited:=credited+1;awarded:=awarded+pts;
 end loop;
 select count(*),coalesce(sum(points),0) into after_correct,after_points from boo_private.plays where points>0;
 select md5(coalesce(string_agg(concat_ws('|',s.user_id,s.photo,s.points,s.correct_at),',' order by s.user_id,s.photo),'')) into after_hash from boo_private.plays s where s.points>0 and not exists(select 1 from boo_private.audit a where a.action='reviewed_spelling_credit_v1' and a.payload->>'reviewRef'=review_ref and (a.payload->>'repairedAt')::timestamptz=stamp and a.payload->>'userId'=s.user_id::text and a.payload->>'photoId'=s.photo::text);
 if positive_hash is distinct from after_hash or after_correct<>before_correct+credited or after_points<>before_points+awarded or first_hash is distinct from (select md5(coalesce(string_agg(concat_ws('|',id,first_correct),',' order by id),'')) from boo_private.photos) or upload_hash is distinct from (select md5(coalesce(string_agg(to_jsonb(c)::text,',' order by c.student_key),'')) from boo_private.contributions c) then raise exception 'Repair preservation check failed; no credits applied.';end if;
 select jsonb_build_object('total',count(*),'correct',count(*)filter(where s.points>0),'incorrect',count(*)filter(where s.points=0),'guessPoints',coalesce(sum(s.points),0)) into after_activity from boo_private.plays s join boo_private.photos f on f.id=s.photo where s.submitted and f.state='active' and f.mode='children';
 with totals as(select user_id,sum(points)::int points from boo_private.score_events('children') group by user_id),ranked as(select *,rank()over(order by points desc)::int placement,count(*)over(partition by points)::int ties from totals)select jsonb_object_agg(user_id,jsonb_build_object('points',points,'placement',placement,'ties',ties)) into after_rankings from ranked;
 insert into boo_private.audit(actor,action,payload) values(null,'reviewed_spelling_batch_v1',jsonb_build_object('reviewRef',review_ref,'repairedAt',stamp,'reviewedCount',24,'creditedCount',credited,'skippedCount',skipped,'awardedPoints',awarded,'beforeActivity',before_activity,'afterActivity',after_activity,'beforeRankings',before_rankings,'afterRankings',after_rankings,'existingPositiveScoresPreserved',true,'existingFirstCorrectWinnersPreserved',true,'uploadContributionsPreserved',true));
end $reviewed$;
