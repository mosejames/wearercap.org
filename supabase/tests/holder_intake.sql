begin;
alter table public.ue_notifications disable trigger ue_dispatch_notification;
do $test$
declare h uuid; b uuid; tok text:='test-holder-'||gen_random_uuid(); r jsonb; r2 jsonb; data jsonb; req uuid; before_items int; stock int;
begin
insert into ue_holders(name,phone,house,token,active) values('Test holder','','amistad',tok,true) returning id into h;
insert into ue_bins(code,name,holder_id) values('TEST-'||upper(substr(gen_random_uuid()::text,1,8)),'Test bin',h) returning id into b;
select (ue_impact()->>'items')::int into before_items;
data:=jsonb_build_object('key',gen_random_uuid(),'qty',3);
r:=ue_holder_action(tok,'giveaway',data);r2:=ue_holder_action(tok,'giveaway',data);
if r<>r2 or (ue_impact()->>'items')::int<>before_items+3 then raise exception 'Count-only or retry double-count failure'; end if;
insert into ue_movements(bin_id,item_type,size,house,qty_delta,kind) values(b,'polo','TEST-SIZE','amistad',6,'add');
r:=ue_holder_action(tok,'giveaway',jsonb_build_object('key',gen_random_uuid(),'qty',2,'binId',b,'itemType','polo','size','TEST-SIZE','house','amistad','deduct',true));
select sum(qty_delta) into stock from ue_movements where bin_id=b;
if stock<>4 then raise exception 'Stock deduction failure'; end if;
r:=ue_holder_action(tok,'request',jsonb_build_object('key',gen_random_uuid(),'qty',1,'parentName','Test family','contact','+12025550101','itemType','polo','size','TEST-SIZE','house','amistad','binId',b,'coordination','holder'));
req:=(r->>'id')::uuid;
if exists(select 1 from ue_notifications where request_id=req and phone='+12025550101') then raise exception 'Unexpected managed SMS'; end if;
r:=ue_holder_action(tok,'plan',jsonb_build_object('key',gen_random_uuid(),'requestId',req,'note','Already arranged','sendText',false));
r:=ue_holder_action(tok,'complete',jsonb_build_object('key',gen_random_uuid(),'requestId',req,'sendText',false));
r2:=ue_holder_action(tok,'complete',jsonb_build_object('key',gen_random_uuid(),'requestId',req,'sendText',false));
if (ue_impact()->>'items')::int<>before_items+6 then raise exception 'Completion double-count'; end if;
if (select sum(qty_delta) from ue_movements where bin_id=b)<>3 then raise exception 'Completion double deduction'; end if;
r:=ue_holder_action(tok,'request',jsonb_build_object('key',gen_random_uuid(),'parentName','Test waitlisted','contact','+12025550102','itemType','polo','size','TEST-SIZE','house','amistad','coordination','holder'));
req:=(r->>'id')::uuid;
if r->>'status'<>'open' then raise exception 'Waitlist failure'; end if;
perform ue_assign_request(req,b);
if exists(select 1 from ue_notifications where request_id=req and phone='+12025550102') then raise exception 'Auto-match sent family scheduling text'; end if;
r:=ue_holder_action(tok,'request',jsonb_build_object('key',gen_random_uuid(),'parentName','Test family scheduling','contact','+12025550103','itemType','polo','size','TEST-SIZE','house','amistad','coordination','family'));
if not exists(select 1 from ue_notifications where request_id=(r->>'id')::uuid and phone='+12025550103') then raise exception 'Family scheduling SMS missing'; end if;
begin
perform ue_holder_action('bad-token','giveaway',jsonb_build_object('key',gen_random_uuid()));
raise exception 'Invalid token accepted';
exception when others then if SQLERRM='Invalid token accepted' then raise; end if; end;
begin
perform ue_holder_action(tok,'giveaway',jsonb_build_object('key',gen_random_uuid(),'qty',99,'deduct',true,'binId',b,'itemType','polo','size','TEST-SIZE','house','amistad'));
raise exception 'Overdraw accepted';
exception when others then if SQLERRM='Overdraw accepted' then raise; end if; end;
data:=jsonb_build_object('key',gen_random_uuid(),'qty',1,'contact','+12025550104','sendText',true);
perform ue_holder_action(tok,'giveaway',data); perform ue_holder_action(tok,'giveaway',data);
if (select count(*) from ue_notifications where phone='+12025550104' and kind='handoff_done')<>1 then raise exception 'Optional confirmation missing or duplicated'; end if;
execute 'set local role anon';
perform ue_holder_action(tok,'giveaway',jsonb_build_object('key',gen_random_uuid(),'qty',1));
perform ue_impact();
execute 'reset role';
if has_table_privilege('anon','ue_private.giveaways','SELECT') then raise exception 'Private ledger exposed'; end if;
end $test$;
rollback;
select 'All holder intake checks passed. No data retained or texts sent.' result;
