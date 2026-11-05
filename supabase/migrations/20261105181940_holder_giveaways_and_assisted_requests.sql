-- Private audit data; only token-checked RPCs can read or write it.
create schema if not exists ue_private;
revoke all on schema ue_private from public;
grant usage on schema ue_private to anon, authenticated;
alter table public.ue_requests
  add column initiated_by uuid references public.ue_holders(id),
  add column coordination text not null default 'family' check (coordination in ('family','holder')),
  add column pickup_note text not null default '' check (length(pickup_note) <= 200);

create table ue_private.giveaways (
  id uuid primary key default gen_random_uuid(),
  holder_id uuid not null references public.ue_holders(id),
  bin_id uuid references public.ue_bins(id),
  request_id uuid unique references public.ue_requests(id),
  qty integer not null check(qty between 1 and 99),
  item_type text references public.ue_item_types(id), size text, house text not null default '',
  recipient_name text not null default '' check(length(recipient_name)<=60),
  phone text not null default '',
  movement_id uuid references public.ue_movements(id),
  created_at timestamptz not null default now()
);
create index ue_giveaways_holder_idx on ue_private.giveaways(holder_id);
create index ue_giveaways_bin_idx on ue_private.giveaways(bin_id);
create table ue_private.action_receipts (
  holder_id uuid not null references public.ue_holders(id),
  key uuid not null, result jsonb not null, primary key(holder_id,key)
);
alter table ue_private.giveaways enable row level security;
alter table ue_private.action_receipts enable row level security;
revoke all on ue_private.giveaways, ue_private.action_receipts from public,anon,authenticated;
create index ue_requests_initiated_by_idx on public.ue_requests(initiated_by);

-- Managed requests must never automatically ask the family to schedule.
create function ue_private.filter_managed_notifications() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.ue_requests%rowtype;
begin
  if new.request_id is null then return new; end if;
  select * into r from public.ue_requests where id=new.request_id;
  if r.coordination <> 'holder' then return new; end if;
  if new.channel='sms' and ue_phone(new.phone)=ue_phone(r.contact)
     and new.kind <> 'handoff_done' then return null; end if;
  if new.kind='holder_request' and r.status='assigned' then
    new.body := 'RCAP Uniform Exchange: ' || r.parent_name || '''s ' ||
      ue_type_label(r.item_type) || ' · ' || r.size ||
      ' is available. The bin holder is coordinating pickup. No family scheduling response is needed.';
  end if;
  return new;
end $$;
revoke all on function ue_private.filter_managed_notifications() from public,anon,authenticated;
create trigger ue_managed_notification_filter before insert on public.ue_notifications
for each row execute function ue_private.filter_managed_notifications();

-- Send availability to the initiating holder too when another bin supplies it.
create function ue_private.managed_stock_ready() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare b uuid;
begin
  if new.coordination='holder' and new.status='assigned' and old.status='open' then
    select id into b from public.ue_bins where holder_id=new.initiated_by and not retired order by code limit 1;
    if b is not null and not exists(select 1 from public.ue_bins where id=new.bin_id and holder_id=new.initiated_by) then
      perform public.ue_notify_holder(b,'holder_request',
        'Stock is available for ' || new.parent_name || '''s ' || ue_type_label(new.item_type) ||
        ' · ' || new.size || '. You are coordinating the handoff.',new.id,null);
    end if;
  end if;
  return new;
end $$;
revoke all on function ue_private.managed_stock_ready() from public,anon,authenticated;
create trigger ue_managed_stock_ready after update of status on public.ue_requests
for each row execute function ue_private.managed_stock_ready();

create function ue_private.holder_action(p_token text,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  h public.ue_holders%rowtype; r public.ue_requests%rowtype; b public.ue_bins%rowtype;
  v_key uuid := (p_data->>'key')::uuid; result jsonb;
  rid uuid := nullif(p_data->>'requestId','')::uuid;
  bid uuid := nullif(p_data->>'binId','')::uuid;
  q integer := coalesce((p_data->>'qty')::integer,1);
  typ text := nullif(p_data->>'itemType',''); sz text := nullif(p_data->>'size','');
  hs text := coalesce(p_data->>'house','');
  nm text := btrim(coalesce(p_data->>'parentName',''));
  raw_phone text := btrim(coalesce(p_data->>'contact',''));
  ph text; mid uuid; gid uuid; free integer; mode text;
  send_text boolean := coalesce((p_data->>'sendText')::boolean,false);
  own_stock boolean := coalesce((p_data->>'deduct')::boolean,false);
  body text;
begin
  select * into h from public.ue_holders where token=p_token and active;
  if not found then raise exception 'This holder link is not active.'; end if;
  if v_key is null then raise exception 'A save key is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(h.id::text || v_key::text,0));
  select a.result into result from ue_private.action_receipts a where a.holder_id=h.id and a.key=v_key;
  if found then return result; end if;
  if p_action not in ('giveaway','request','plan','complete') then raise exception 'Unknown action.'; end if;
  ph:=ue_phone(raw_phone);
  if raw_phone<>'' and ph='' then raise exception 'Enter a valid cell number.'; end if;
  if send_text and ph='' and rid is null then raise exception 'Add a cell number to send a text.'; end if;
  if q<1 or q>99 then raise exception 'Quantity must be between 1 and 99.'; end if;
  if length(nm)>60 or length(coalesce(p_data->>'note',''))>200 then raise exception 'Name or note is too long.'; end if;
  if hs not in ('','amistad','altruismo','isibindi','reveur') then raise exception 'Choose a valid house.'; end if;
  if typ is not null and not exists(select 1 from public.ue_item_types where id=typ and not hidden) then raise exception 'Choose an available item.'; end if;

  if rid is not null then
    select * into r from public.ue_requests where id=rid for update;
    if not found or not (r.initiated_by=h.id or exists(select 1 from public.ue_bins where id=r.bin_id and holder_id=h.id and not retired)) then
      raise exception 'That request is not in your care.';
    end if;
    if p_action='complete' and r.status='fulfilled' then
      result:=jsonb_build_object('id',r.id,'status','fulfilled','alreadyRecorded',true);
      insert into ue_private.action_receipts values(h.id,v_key,result); return result;
    end if;
    if r.status in ('fulfilled','canceled') then raise exception 'This request is closed.'; end if;
    if p_action not in ('plan','complete') then raise exception 'Use the request completion action.'; end if;
    if p_action='complete' and (r.status='open' or r.bin_id is null) then raise exception 'This request is still waiting for stock.'; end if;
    bid:=r.bin_id; typ:=r.item_type; sz:=r.size; hs:=r.house; q:=r.qty; nm:=r.parent_name; ph:=ue_phone(r.contact);
  elsif p_action in ('plan','complete') then raise exception 'Choose a request.';
  end if;

  if bid is not null then
    select * into b from public.ue_bins where id=bid and not retired;
    if not found or (b.holder_id<>h.id and not (rid is not null and r.initiated_by=h.id)) then raise exception 'Choose a bin in your care.'; end if;
    -- Serialize giveaways and reservations made through this intake.
    perform pg_advisory_xact_lock(hashtextextended(bid::text,0));
  end if;

  if p_action='plan' then
    update public.ue_requests set coordination='holder',initiated_by=coalesce(initiated_by,h.id),
      pickup_note=btrim(coalesce(p_data->>'note','')),
      handoff_date=nullif(p_data->>'date','')::date,
      holder_confirmed_at=now() where id=rid;
    result:=jsonb_build_object('id',rid,'status',r.status);
    body:='RCAP Uniform Exchange: your bin holder has arranged pickup for your ' || ue_type_label(typ) || ' · ' || sz || '. ' || coalesce(p_data->>'note','');
  else
    if p_action='request' then
      if nm='' or ph='' or typ is null or sz is null or length(sz)>20 or q>5 then raise exception 'Add a name, cell number, item, size, and quantity (1 to 5).'; end if;
      if exists(select 1 from ue_item_types where id=typ and housed) and hs='' then raise exception 'Choose the item house.'; end if;
      if not exists(select 1 from ue_item_types where id=typ and housed) then hs:=''; end if;
      mode:=coalesce(p_data->>'coordination','holder');
      if mode not in ('holder','family') then raise exception 'Choose who arranges pickup.'; end if;
      if bid is not null then own_stock:=true; end if;
    end if;
    if p_action='complete' then own_stock:=true; end if;
    if own_stock then
      if exists(select 1 from ue_item_types where id=typ and housed) and hs='' then raise exception 'Choose the item house before deducting stock.'; end if;
      if bid is null or typ is null or sz is null then raise exception 'Choose a bin, item and size before deducting stock.'; end if;
      select coalesce(sum(qty_delta),0) into free from public.ue_movements
        where bin_id=bid and item_type=typ and size=sz and house=hs;
      -- Handed-off items have already left stock. Do not reserve them twice.
      free:=free-coalesce((select sum(qty) from public.ue_requests
        where bin_id=bid and item_type=typ and size=sz and house=hs
          and status in ('assigned','scheduled') and (rid is null or id<>rid)),0);
      if not (p_action='complete' and exists(select 1 from public.ue_movements where request_id=rid and kind='fulfill')) and free<q then
        raise exception 'Not enough unreserved stock. Refresh your bins or record an untracked giveaway without deducting stock.';
      end if;
    end if;
    if p_action='request' then
      insert into public.ue_requests(parent_name,contact,student,item_type,size,house,requester_house,qty,note,bin_id,initiated_by,coordination,family_shared,pickup_note)
      values(nm,ph,btrim(coalesce(p_data->>'student','')),typ,sz,hs,coalesce(p_data->>'requesterHouse',h.house),q,
        btrim(coalesce(p_data->>'note','')),bid,h.id,mode,true,case when mode='holder' then btrim(coalesce(p_data->>'pickupNote','')) else '' end)
      returning * into r;
      result:=jsonb_build_object('id',r.id,'status',r.status);
      body:='RCAP Uniform Exchange: we recorded your request for ' || ue_type_label(typ) || ' · ' || sz ||
        case when r.status='open' then '. It is waiting for stock. Your bin holder is coordinating with you.' else '. Your bin holder is coordinating pickup with you.' end;
    else
      if own_stock and not exists(select 1 from public.ue_movements where request_id=rid and kind='fulfill') then
        insert into public.ue_movements(bin_id,item_type,size,house,qty_delta,kind,actor_name,note,request_id)
        values(bid,typ,sz,hs,-q,'fulfill',h.name,'Recorded giveaway',rid) returning id into mid;
      end if;
      if rid is not null then
        update public.ue_requests set status='fulfilled',fulfilled_at=now() where id=rid;
      end if;
      insert into ue_private.giveaways(holder_id,bin_id,request_id,qty,item_type,size,house,recipient_name,phone,movement_id)
      values(h.id,bid,rid,q,typ,sz,hs,nm,ph,mid) returning id into gid;
      result:=jsonb_build_object('id',coalesce(rid,gid),'status','fulfilled');
      body:='RCAP Uniform Exchange: thank you for giving ' || q || ' uniform item' || case when q=1 then '' else 's' end || ' a new home!';
    end if;
  end if;
  -- Family-managed requests already receive the normal scheduling notification.
  if send_text and ph<>'' and not (p_action='request' and mode='family') then
    insert into public.ue_notifications(kind,channel,phone,body,request_id)
    values('handoff_done','sms',ph,body || ' For future needs: ' ||
      case when p_action='giveaway' then 'https://wearercap.org/uniform-exchange/' else public.ue_my_url(ph) end,
      case when p_action='request' then r.id else rid end);
  end if;
  insert into ue_private.action_receipts values(h.id,v_key,result);
  return result;
end $$;
revoke all on function ue_private.holder_action(text,text,jsonb) from public;
grant execute on function ue_private.holder_action(text,text,jsonb) to anon,authenticated;
create function public.ue_holder_action(p_token text,p_action text,p_data jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select ue_private.holder_action(p_token,p_action,p_data);
$$;
revoke all on function public.ue_holder_action(text,text,jsonb) from public;
grant execute on function public.ue_holder_action(text,text,jsonb) to anon,authenticated;

-- Public impact is counts only. Request-linked giveaways count through the
-- fulfilled request, never through both records. No family or house breakdown.
create function ue_private.impact() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
with events as (
  select qty,fulfilled_at at from public.ue_requests where status='fulfilled'
  union all select qty,created_at from ue_private.giveaways where request_id is null
)
select jsonb_build_object('items',coalesce(sum(qty),0),'transactions',count(*),
 'yearItems',coalesce(sum(qty) filter(where at >= date_trunc('year',now() at time zone 'America/New_York') at time zone 'America/New_York'),0),
 'yearTransactions',count(*) filter(where at >= date_trunc('year',now() at time zone 'America/New_York') at time zone 'America/New_York')) from events;
$$;
revoke all on function ue_private.impact() from public;
grant execute on function ue_private.impact() to anon,authenticated;
create function public.ue_impact() returns jsonb language sql stable security invoker set search_path='' as $$ select ue_private.impact(); $$;
revoke all on function public.ue_impact() from public;
grant execute on function public.ue_impact() to anon,authenticated;

-- Add coordination fields without changing the existing RPC's return signature.
create function ue_private.request_modes(p_token text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'coordination',r.coordination,'pickup_note',r.pickup_note)),'[]'::jsonb)
from public.ue_requests r join public.ue_access a on a.phone=ue_phone(r.contact) where a.token=p_token;
$$;
revoke all on function ue_private.request_modes(text) from public;
grant execute on function ue_private.request_modes(text) to anon,authenticated;
create function public.ue_request_modes(p_token text) returns jsonb language sql stable security invoker set search_path='' as $$ select ue_private.request_modes(p_token); $$;
revoke all on function public.ue_request_modes(text) from public;
grant execute on function public.ue_request_modes(text) to anon,authenticated;
CREATE OR REPLACE FUNCTION public.ue_holder_home(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare h public.ue_holders%rowtype;
begin
  select * into h from public.ue_holders where token = p_token;
  if not found then return null; end if;

  return json_build_object(
    'holder', json_build_object(
      'id', h.id, 'name', h.name, 'phone', h.phone, 'email', h.email,
      'house', h.house, 'student', h.student, 'note', h.note,
      'offers_carline', h.offers_carline, 'offers_student', h.offers_student,
      'carline_days', h.carline_days, 'carline_when', h.carline_when,
      'carline_spot', h.carline_spot, 'notify_mode', h.notify_mode,
      'special_arrangements', h.special_arrangements, 'special_note', h.special_note,
      'photo_url', h.photo_url, 'max_handoff_days', h.max_handoff_days),

    'bins', coalesce((
      select json_agg(row_to_json(b) order by b.code) from (
        select id, code, name, focus, retired
        from public.ue_bins where holder_id = h.id
      ) b), '[]'::json),

    'inventory', coalesce((
      select json_agg(row_to_json(i)) from (
        select v.bin_id, v.item_type, v.size, v.house, v.qty
        from public.ue_inventory v
        join public.ue_bins bb on bb.id = v.bin_id
        where bb.holder_id = h.id
      ) i), '[]'::json),

    'queue', coalesce((
      select json_agg(row_to_json(q)) from (
        select r.id, r.parent_name, r.student, r.item_type, r.size, r.house,
               r.coordination, r.pickup_note, r.initiated_by, r.qty, r.note, r.status, r.bin_id, r.due_at,
               r.handoff_mode, r.handoff_date, r.handoff_slot,
               r.family_shared, r.holder_shared, r.holder_confirmed_at,
               case when r.family_shared then ue_phone_pretty(r.contact) else '' end family_phone
        from public.ue_requests r
        left join public.ue_bins bb on bb.id = r.bin_id
        where (bb.holder_id = h.id or r.initiated_by = h.id)
          and r.status in ('open','assigned','scheduled','handed_off')
        order by r.due_at nulls last
      ) q), '[]'::json),

    'pickups', coalesce((
      select json_agg(row_to_json(o)) from (
        select f.id, f.parent_name, f.contact, f.house, f.items_desc, f.status, f.bin_id
        from public.ue_offers f
        join public.ue_bins bb on bb.id = f.bin_id
        where bb.holder_id = h.id and f.status in ('open','scheduled')
        order by f.created_at
      ) o), '[]'::json)
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.ue_handoff_schedule(p_id uuid, p_mode text, p_date date DEFAULT NULL::date, p_slot text DEFAULT ''::text, p_student text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.ue_requests%rowtype;
  b public.ue_bins%rowtype;
  h public.ue_holders%rowtype;
  lbl text; item text; hname text; spot text; extra integer;
begin
  if p_mode not in ('carline','student','desk') then raise exception 'Unknown handoff mode'; end if;

  update public.ue_requests set
    handoff_mode = p_mode,
    handoff_date = p_date,
    handoff_slot = coalesce(p_slot, ''),
    student      = coalesce(nullif(btrim(p_student), ''), student),
    status       = 'scheduled',
    due_at       = coalesce((p_date + interval '1 day')::timestamptz, now() + interval '3 days'),
    holder_confirmed_at = null,
    confirm_nudged_at   = null
  where id = p_id and coordination = 'family' and status in ('assigned','scheduled')
  returning * into r;
  if not found then raise exception 'Request is not ready to be scheduled'; end if;

  select * into b from public.ue_bins where id = r.bin_id;
  select * into h from public.ue_holders where id = b.holder_id;

  update public.ue_requests o set
    handoff_mode = r.handoff_mode,
    handoff_date = r.handoff_date,
    handoff_slot = r.handoff_slot,
    status       = 'scheduled',
    due_at       = r.due_at,
    holder_confirmed_at = null,
    confirm_nudged_at   = null
  from public.ue_bins ob
  where ob.id = o.bin_id
    and o.id <> r.id
    and ob.holder_id = b.holder_id
    and b.holder_id is not null
    and o.status = 'assigned' and o.coordination = 'family'
    and ue_phone(o.contact) = ue_phone(r.contact)
    and ue_phone(r.contact) <> '';
  get diagnostics extra = row_count;

  hname := coalesce(nullif(h.name, ''), nullif(b.holder_name, ''), 'your bin holder');
  spot  := coalesce(nullif(h.carline_spot, ''), b.carline_spot, '');
  lbl   := ue_slot_label(r.handoff_date, r.handoff_slot, r.handoff_mode);
  item  := trim(ue_type_label(r.item_type) || ' · ' || r.size);
  if extra > 0 then
    item := item || ' (and ' || extra || ' more of yours)';
  end if;

  -- Honest about what has and hasn't happened: the time is picked; the
  -- person hasn't answered yet.
  if ue_phone(r.contact) <> '' then
    insert into ue_notifications (kind, phone, body, request_id)
    values ('handoff_set', ue_phone(r.contact),
      'RCAP Uniform Exchange: you picked ' || lbl || ' for your ' || item ||
      case when p_mode = 'student' then ', so it''ll come home in a backpack. '
           else ' with ' || hname ||
                case when spot <> '' then ' (' || spot || ')' else '' end || '. ' end ||
      'We''ve asked ' || split_part(hname, ' ', 1) || ' to confirm and will text you when they do. ' ||
      'Your requests: ' || ue_my_url(r.contact),
      r.id);
  end if;

  if b.id is not null then
    perform ue_notify_holder(b.id, 'handoff_set',
      r.parent_name || ' picked a handoff for the ' || item || ' — ' || lbl ||
      case when p_mode = 'student' and coalesce(r.student,'') <> ''
           then '. Send it in with your student for ' || r.student || '.'
           else '.' end ||
      ' Tap "I''ll be there" on your page so they know you''ve seen it.',
      r.id, null);
  end if;
end;
$function$
;

;
