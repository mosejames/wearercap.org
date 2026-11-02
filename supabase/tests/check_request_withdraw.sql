-- Withdraw: only the requester, only before approval, record retained.
-- Everything rolls back. No email or text is sent.
begin;
do $$
declare parent uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); p jsonb; r jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(parent,'cr-wd-parent@example.test',now()),(other,'cr-wd-other@example.test',now());
 perform set_config('request.jwt.claim.sub',parent::text,true);
 insert into storage.objects(bucket_id,name,metadata) values('check-receipts',parent::text||'/'||rid::text||'/receipt.pdf','{"size":100,"mimetype":"application/pdf"}');
 p:=jsonb_build_object('id',rid,'requester_name','Test Parent','phone','4045550123','payee','Test Parent','delivery','zelle','zelle_contact','cr-wd-parent@example.test','request_type','reimbursement','budget_confirmed',true,'committee','General RCAP','purpose','Supplies for an RCAP event','acknowledged',true,
  'items',jsonb_build_array(jsonb_build_object('date',current_date::text,'vendor','Test Store','description','Test expense','amount_cents',1250,'document_total_cents',1250,'receipts',jsonb_build_array(jsonb_build_object('path',parent::text||'/'||rid::text||'/receipt.pdf','name','receipt.pdf')))));
 r:=public.cr_action('submit',p);
 perform set_config('request.jwt.claim.sub',other::text,true);
 begin perform public.cr_action('withdraw',jsonb_build_object('id',rid,'version',(r->>'version')::int));raise exception 'TEST outsider withdrew';
 exception when others then if sqlerrm not like '%not found%' and sqlerrm not like '%Only the person%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',parent::text,true);
 r:=public.cr_action('withdraw',jsonb_build_object('id',rid,'version',(r->>'version')::int,'note','Submitted twice.'));
 if r->>'status'<>'declined' then raise exception 'TEST withdraw status %',r->>'status';end if;
 if not exists(select 1 from public.cr_history where request_id=rid and action='withdrawn' and note like 'Withdrawn by the requester. Submitted twice.%') then raise exception 'TEST withdraw history missing';end if;
 if not exists(select 1 from public.cr_notifications where request_id=rid and body like '%withdrawn by the requester%') then raise exception 'TEST withdraw notice missing';end if;
 if not exists(select 1 from public.cr_notifications where request_id=rid and archive_snapshot->'event'->>'action'='withdrawn') then raise exception 'TEST withdraw archive missing';end if;
 if not exists(select 1 from storage.objects where bucket_id='check-receipts' and name=parent::text||'/'||rid::text||'/receipt.pdf') then raise exception 'TEST receipt removed';end if;
 begin perform public.cr_action('withdraw',jsonb_build_object('id',rid,'version',(r->>'version')::int));raise exception 'TEST closed request withdrawn twice';
 exception when others then if sqlerrm not like '%not been approved%' then raise;end if;end;
end $$;
rollback;
