begin;
alter table public.ue_notifications disable trigger ue_dispatch_notification;

do $test$
declare r uuid; t text; actual integer; expected integer; owner_phone text; b uuid;
begin
select ue_phone(phone) into owner_phone from ue_holders where name='Shekita James';
foreach t in array array['pants-boys','pants-girls','pants-girls-boot','shorts-boys','shorts-girls','skirt'] loop
insert into ue_requests(parent_name,contact,item_type,size,qty,house,requester_house) values ('Routing test','',t,'10',1,'','reveur') returning id into r;
select count(*) into actual from ue_notifications where request_id=r and kind='holder_request';
if actual<>1 or not exists(select 1 from ue_notifications where request_id=r and phone=owner_phone and body like '%not in our inventory%') then raise exception 'Khaki routing failed for %',t; end if;
end loop;
foreach t in array array['polo','dress-shirt','blouse'] loop
insert into ue_requests(parent_name,contact,item_type,size,qty,house,requester_house) values ('Routing test','',t,'10',1,case when t='polo' then 'amistad' else '' end,'amistad') returning id into r;
select count(*) into actual from ue_notifications where request_id=r and kind='holder_request';
select count(distinct h.id) into expected from ue_holders h join ue_bins b on b.holder_id=h.id where h.active and not b.retired and h.house='amistad';
if actual<>expected or actual<>2 then raise exception 'House routing failed for %: % vs %',t,actual,expected; end if;
end loop;
select id into b from ue_bins where holder_id=(select id from ue_holders where name='Shekita James') and not retired limit 1;
insert into ue_requests(parent_name,contact,item_type,size,qty,house,requester_house,bin_id) values ('Routing test','','pants-boys','10',1,'','reveur',b) returning id into r;
select count(*) into actual from ue_notifications where request_id=r and kind='holder_request';
if actual<>1 then raise exception 'Duplicate assigned alert: %',actual; end if;
end $test$;
rollback;
select 'Routing assertions passed; all test records rolled back; no texts dispatched' result;
