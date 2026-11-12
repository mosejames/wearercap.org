-- Adjustable approved amount. Test data only: every row is created inside this
-- transaction and rolled back. Dispatch is switched off for the transaction,
-- so no email or text is sent. No live request is read for a decision or
-- changed.
begin;
alter table public.cr_notifications disable trigger cr_notify;
do $$
declare parent uuid:=gen_random_uuid(); reviewer uuid:=gen_random_uuid(); treasurer uuid:=gen_random_uuid();
 member_b uuid:=gen_random_uuid(); member_c uuid:=gen_random_uuid();
 rid uuid; p jsonb; base jsonb; r jsonb; h record; n int;
begin
 insert into auth.users(id,email,email_confirmed_at) values
  (parent,'aa-parent@example.test',now()),(reviewer,'aa-reviewer@example.test',now()),
  (treasurer,'aa-treasurer@example.test',now()),(member_b,'aa-member-b@example.test',now()),
  (member_c,'aa-member-c@example.test',now());
 insert into public.cr_staff(email,name,role) values
  ('aa-reviewer@example.test','Amount Test Reviewer','board'),
  ('aa-treasurer@example.test','Amount Test Treasurer','treasurer'),
  ('aa-member-b@example.test','Amount Test Member B','board'),
  ('aa-member-c@example.test','Amount Test Member C','board');
 -- The reviewer is the committee's primary reviewer, which makes them the
 -- board liaison for corrections.
 insert into public.cr_payment_committees(name,added_by) values('TEST Approved Amount','aa-treasurer@example.test');
 insert into public.cr_approval_routes(committee,request_type,approver_email,updated_by) values
  ('TEST Approved Amount','reimbursement','aa-reviewer@example.test','aa-treasurer@example.test'),
  ('TEST Approved Amount','vendor','aa-reviewer@example.test','aa-treasurer@example.test');
 base:=jsonb_build_object('requester_name','Amount Test Parent','phone','4045550123','payee','Amount Test Parent','delivery','zelle','zelle_contact','aa-parent@example.test','request_type','reimbursement','budget_confirmed',true,'committee','TEST Approved Amount','purpose','Supplies for a test event','acknowledged',true);

 ------------------------------------------------ reimbursement, reduced
 rid:=gen_random_uuid();
 insert into storage.objects(bucket_id,name,metadata) values('check-receipts',parent::text||'/'||rid::text||'/receipt.pdf','{"size":100,"mimetype":"application/pdf"}');
 p:=base||jsonb_build_object('id',rid,'items',jsonb_build_array(jsonb_build_object('date',current_date::text,'vendor','Test Store','description','Test expense','amount_cents',62753,'document_total_cents',62753,'receipts',jsonb_build_array(jsonb_build_object('path',parent::text||'/'||rid::text||'/receipt.pdf','name','receipt.pdf')))));
 perform set_config('request.jwt.claim.sub',parent::text,true);
 r:=public.cr_action('submit',p);
 if r->>'status'<>'submitted' or r->>'approver_email'<>'aa-reviewer@example.test' or r->>'approved_cents' is not null then raise exception 'TEST submission routing or early approved amount: %',r;end if;
 -- Self-approval restriction is unchanged.
 begin perform public.cr_action('approved',jsonb_build_object('id',rid,'version',1));raise exception 'TEST requester approved own request';
 exception when others then if sqlerrm not like '%own request%' then raise;end if;end;
 -- Only the assigned reviewer approves.
 perform set_config('request.jwt.claim.sub',member_b::text,true);
 begin perform public.cr_action('approved',jsonb_build_object('id',rid,'version',1,'approved_cents',61905,'amount_reason','Budget limit reached.'));raise exception 'TEST unassigned member approved';
 exception when others then if sqlerrm not like '%Only the assigned board member%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 -- Invalid amounts.
 begin perform public.cr_action('approved',jsonb_build_object('id',rid,'version',1,'approved_cents',0,'amount_reason','Budget limit reached.'));raise exception 'TEST zero approved';
 exception when others then if sqlerrm not like '%greater than zero%' then raise;end if;end;
 begin perform public.cr_action('approved',jsonb_build_object('id',rid,'version',1,'approved_cents',62754,'amount_reason','Budget limit reached.'));raise exception 'TEST above requested approved';
 exception when others then if sqlerrm not like '%no more than the requested amount%' then raise;end if;end;
 begin perform public.cr_action('approved',jsonb_build_object('id',rid,'version',1,'approved_cents','619.05','amount_reason','Budget limit reached.'));raise exception 'TEST malformed amount approved';
 exception when others then if sqlerrm not like '%dollars and cents%' then raise;end if;end;
 begin perform public.cr_action('approved',jsonb_build_object('id',rid,'version',1,'approved_cents',-5,'amount_reason','Budget limit reached.'));raise exception 'TEST negative amount approved';
 exception when others then if sqlerrm not like '%dollars and cents%' then raise;end if;end;
 -- A reduction requires a reason.
 begin perform public.cr_action('approved',jsonb_build_object('id',rid,'version',1,'approved_cents',61905));raise exception 'TEST reduced without reason';
 exception when others then if sqlerrm not like '%reason for approving less%' then raise;end if;end;
 begin perform public.cr_action('approved',jsonb_build_object('id',rid,'version',1,'approved_cents',61905,'amount_reason','  no '));raise exception 'TEST reduced with blank reason';
 exception when others then if sqlerrm not like '%reason for approving less%' then raise;end if;end;
 if (select status from public.cr_requests where id=rid)<>'submitted' then raise exception 'TEST failed attempts changed the request';end if;
 r:=public.cr_action('approved',jsonb_build_object('id',rid,'version',1,'approved_cents',61905,'amount_reason','Only $619.05 remains in the event budget'));
 if r->>'status'<>'approved' or (r->>'approved_cents')::bigint<>61905 or (r->>'total_cents')::bigint<>62753 or r->>'approved_amount_reason'<>'Only $619.05 remains in the event budget' then raise exception 'TEST reduced approval record: %',r;end if;
 select * into h from public.cr_history where request_id=rid and action='approved';
 if h.actor_email<>'aa-reviewer@example.test' or h.created_at is null or h.note not like 'Approved $619.05 payable to Amount Test Parent. Requested $627.53. Reason for the lower amount: Only $619.05 remains in the event budget.%' then raise exception 'TEST reduced approval history: %',h.note;end if;
 -- The approval summary reaches the requester with both amounts and the reason.
 if not exists(select 1 from public.cr_notifications where request_id=rid and archive_snapshot is null and recipients @> array['aa-parent@example.test']
   and subject like '%: approved' and body like '%approved for $619.05 of the $627.53 requested%' and body like '%Approved amount: $619.05%'
   and body like '%Requested amount: $627.53%' and body like '%Reason for the difference: Only $619.05 remains in the event budget%') then raise exception 'TEST reduced approval summary';end if;
 if not exists(select 1 from public.cr_notifications where request_id=rid and (archive_snapshot->'request'->>'approved_cents')::bigint=61905 and archive_snapshot->'event'->>'action'='approved') then raise exception 'TEST reduced approval archive';end if;

 ------------------------------------------------ correction permissions
 perform set_config('request.jwt.claim.sub',parent::text,true);
 begin perform public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',2,'approved_cents',62753,'amount_reason','I would like the full amount.'));raise exception 'TEST requester corrected own amount';
 exception when others then if sqlerrm not like '%own request%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',member_b::text,true);
 begin perform public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',2,'approved_cents',60000,'amount_reason','Budget recount.'));raise exception 'TEST non-liaison member corrected amount';
 exception when others then if sqlerrm not like '%Only the treasurer or the committee%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',treasurer::text,true);
 begin perform public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',2,'approved_cents',61905,'amount_reason','Budget recount.'));raise exception 'TEST unchanged correction';
 exception when others then if sqlerrm not like '%different amount%' then raise;end if;end;
 begin perform public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',2,'approved_cents',60000));raise exception 'TEST correction without reason';
 exception when others then if sqlerrm not like '%reason for the correction%' then raise;end if;end;
 begin perform public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',2,'approved_cents',62754,'amount_reason','Budget recount.'));raise exception 'TEST correction above requested';
 exception when others then if sqlerrm not like '%no more than the requested amount%' then raise;end if;end;
 begin perform public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',2,'approved_cents',0,'amount_reason','Budget recount.'));raise exception 'TEST correction to zero';
 exception when others then if sqlerrm not like '%greater than zero%' then raise;end if;end;
 begin perform public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',2,'amount_reason','Budget recount.'));raise exception 'TEST correction without amount';
 exception when others then if sqlerrm not like '%dollars and cents%' then raise;end if;end;
 -- Treasurer correction, with who, when, both amounts and the reason recorded.
 -- (Every row in this transaction shares one timestamp, so the notice's
 -- "Corrected by" name is checked by label only; history holds the actor.)
 r:=public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',2,'approved_cents',60000,'amount_reason','Budget recount after a late receipt.'));
 if r->>'status'<>'approved' or (r->>'approved_cents')::bigint<>60000 or (r->>'total_cents')::bigint<>62753 or r->>'version'<>'3' then raise exception 'TEST treasurer correction record: %',r;end if;
 select * into h from public.cr_history where request_id=rid and action='amount_corrected';
 if h.actor_email<>'aa-treasurer@example.test' or h.created_at is null or h.note<>'Approved amount corrected from $619.05 to $600.00. Requested $627.53. Reason: Budget recount after a late receipt.' then raise exception 'TEST correction history: %',h.note;end if;
 if not exists(select 1 from public.cr_notifications where request_id=rid and archive_snapshot is null and recipients @> array['aa-parent@example.test']
   and subject like '%: amount corrected' and body like '%The approved amount is now $600.00 of the $627.53 requested%'
   and body like '%Approved amount: $600.00%' and body like '%Reason for the difference: Budget recount after a late receipt.%'
   and body like '%Corrected by: %' and body like '%Payment has not been sent yet.%') then raise exception 'TEST requester correction notice';end if;
 if not exists(select 1 from public.cr_notifications where request_id=rid and archive_snapshot->'event'->>'action'='amount_corrected' and (archive_snapshot->'request'->>'approved_cents')::bigint=60000) then raise exception 'TEST correction archive';end if;
 -- The liaison (primary committee reviewer) can correct too, up to the full request.
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 r:=public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',3,'approved_cents',62753,'amount_reason','The committee released the remaining funds.'));
 if (r->>'approved_cents')::bigint<>62753 then raise exception 'TEST liaison correction';end if;
 r:=public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',4,'approved_cents',61905,'amount_reason','Back to the remaining event budget.'));
 if (r->>'approved_cents')::bigint<>61905 or (select count(*) from public.cr_history where request_id=rid and action='amount_corrected')<>3 then raise exception 'TEST repeated correction';end if;

 ------------------------------------------------------------ paid lock
 perform set_config('request.jwt.claim.sub',treasurer::text,true);
 r:=public.cr_action('paid',jsonb_build_object('id',rid,'version',5,'payment_date',current_date,'payment_reference','TEST-REF-0001','payment_method','zelle'));
 if r->>'status'<>'paid' or (r->>'approved_cents')::bigint<>61905 or (r->>'total_cents')::bigint<>62753 then raise exception 'TEST payment changed amounts: %',r;end if;
 begin perform public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',6,'approved_cents',60000,'amount_reason','Too late to change.'));raise exception 'TEST correction after payment';
 exception when others then if sqlerrm not like '%approved amount is locked%' then raise;end if;end;
 begin update public.cr_requests set approved_cents=60000 where id=rid;raise exception 'TEST direct update after payment';
 exception when others then if sqlerrm not like '%approved amount is locked%' then raise;end if;end;

 ------------------------------------------- vendor payment, full amount
 rid:=gen_random_uuid();
 insert into storage.objects(bucket_id,name,metadata) values('check-receipts',parent::text||'/'||rid::text||'/invoice.pdf','{"size":100,"mimetype":"application/pdf"}');
 p:=base||jsonb_build_object('id',rid,'request_type','vendor','payee','Test Vendor LLC','items',jsonb_build_array(jsonb_build_object('date',current_date::text,'vendor','','description','Test invoice','amount_cents',102500,'document_total_cents',102500,'receipts',jsonb_build_array(jsonb_build_object('path',parent::text||'/'||rid::text||'/invoice.pdf','name','invoice.pdf')))));
 perform set_config('request.jwt.claim.sub',parent::text,true);
 r:=public.cr_action('submit',p);
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 -- The existing approve call, with no amount, still approves in full.
 r:=public.cr_action('approved',jsonb_build_object('id',rid,'version',1));
 if r->>'status'<>'approved' or (r->>'approved_cents')::bigint<>102500 or r->>'approved_amount_reason'<>'' then raise exception 'TEST full vendor approval: %',r;end if;
 if exists(select 1 from public.cr_history where request_id=rid and action='approved' and note like '%Requested $%') then raise exception 'TEST full approval mentions a difference';end if;
 if not exists(select 1 from public.cr_notifications where request_id=rid and archive_snapshot is null and body like '%Approved amount: $1,025.00%' and body not like '%Requested amount:%' and body like '%has been approved; payment is pending%') then raise exception 'TEST full approval summary';end if;
 r:=public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',2,'approved_cents',100000,'amount_reason','Vendor applied a credit to the invoice.'));
 if (r->>'approved_cents')::bigint<>100000 or r->>'request_type'<>'vendor' then raise exception 'TEST vendor correction';end if;

 --------------------------------------------- board vote approves in full
 rid:=gen_random_uuid();
 insert into storage.objects(bucket_id,name,metadata) values('check-receipts',parent::text||'/'||rid::text||'/receipt.pdf','{"size":100,"mimetype":"application/pdf"}');
 p:=base||jsonb_build_object('id',rid,'items',jsonb_build_array(jsonb_build_object('date',current_date::text,'vendor','Test Store','description','Test expense','amount_cents',5000,'document_total_cents',5000,'receipts',jsonb_build_array(jsonb_build_object('path',parent::text||'/'||rid::text||'/receipt.pdf','name','receipt.pdf')))));
 perform set_config('request.jwt.claim.sub',parent::text,true);
 r:=public.cr_action('submit',p);
 perform set_config('request.jwt.claim.sub',treasurer::text,true);
 r:=public.cr_action('board_review',jsonb_build_object('id',rid,'version',1));
 n:=cardinality(cr_private.voters(rid))/2+1;
 if n>4 then raise exception 'TEST needs % yes votes; add test voters',n;end if;
 r:=public.cr_action('vote_approve',jsonb_build_object('id',rid,'version',(r->>'version')::int,'approved_cents',100,'amount_reason','A vote cannot lower the amount.'));
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 if r->>'status'='board_review' then r:=public.cr_action('vote_approve',jsonb_build_object('id',rid,'version',(r->>'version')::int));end if;
 perform set_config('request.jwt.claim.sub',member_b::text,true);
 if r->>'status'='board_review' then r:=public.cr_action('vote_approve',jsonb_build_object('id',rid,'version',(r->>'version')::int));end if;
 perform set_config('request.jwt.claim.sub',member_c::text,true);
 if r->>'status'='board_review' then r:=public.cr_action('vote_approve',jsonb_build_object('id',rid,'version',(r->>'version')::int));end if;
 if r->>'status'<>'approved' or (r->>'approved_cents')::bigint<>5000 or r->>'approved_amount_reason'<>'' then raise exception 'TEST board vote approval: %',r;end if;
 -- Correction after a vote follows the same rule.
 perform set_config('request.jwt.claim.sub',treasurer::text,true);
 r:=public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',(r->>'version')::int,'approved_cents',4500,'amount_reason','One item was returned to the store.'));
 if (r->>'approved_cents')::bigint<>4500 then raise exception 'TEST correction after board vote';end if;

 ------------------------------------------------ declined has no amount
 rid:=gen_random_uuid();
 insert into storage.objects(bucket_id,name,metadata) values('check-receipts',parent::text||'/'||rid::text||'/receipt.pdf','{"size":100,"mimetype":"application/pdf"}');
 p:=p||jsonb_build_object('id',rid);
 p:=jsonb_set(p,'{items,0,receipts}',jsonb_build_array(jsonb_build_object('path',parent::text||'/'||rid::text||'/receipt.pdf','name','receipt.pdf')));
 perform set_config('request.jwt.claim.sub',parent::text,true);
 r:=public.cr_action('submit',p);
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 r:=public.cr_action('declined',jsonb_build_object('id',rid,'version',1,'note','Not an RCAP expense.','approved_cents',100));
 if r->>'status'<>'declined' or r->>'approved_cents' is not null then raise exception 'TEST declined request has an approved amount';end if;
 begin perform public.cr_action('correct_amount',jsonb_build_object('id',rid,'version',2,'approved_cents',100,'amount_reason','Not approved.'));raise exception 'TEST correction on a declined request';
 exception when others then if sqlerrm not like '%Only an approved, unpaid request%' then raise;end if;end;

 ------------------------------------------------- schema and ledger feed
 if exists(select 1 from public.cr_requests where status in ('approved','paid') and approved_cents is null) then raise exception 'TEST approved or paid request without an approved amount';end if;
 if pg_get_functiondef('cr_private.ledger_snapshot(text)'::regprocedure) not like '%''approved_cents'', r.approved_cents%' then raise exception 'TEST ledger feed lacks the approved amount';end if;
 raise notice 'PASS: full and reduced approval, invalid amounts, required reasons, correction permissions, requester notices, paid lock, vendor payments, board vote';
end $$;
rollback;
select 'Adjustable approved amount passed. All test data rolled back.' as result;
