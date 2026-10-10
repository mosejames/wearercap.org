begin;
alter table playbook_private.committees drop constraint committees_id_check;
alter table playbook_private.committees add constraint committees_id_check check(id in ('marcom','men','trunk','raffle'));
insert into playbook_private.committees(id,name,folder_id,doc_id,record_id) values ('raffle','Fall Raffle','1UhDKmZfOITk0Uj2YePQwaLBc-DFY-FA6','1161czHzH9NTMSRScxmUIeuwkClu56dkv4rrqzfplg04','1UyWDH2Ei1FhnTBfL_1AAZyACC7GiTZxMsoWHsrqHVfU');
-- Carry over existing organization administrators and the user's two sign-in emails.
insert into playbook_private.members(committee,email,role) select 'raffle',email,'lead' from (values ('mose@mosejames.com'),('mosejames4@gmail.com'),('rcaparents@ronclarkacademy.com'),('crystalelizabethj@gmail.com'),('lemeri@abc-seniors.com'),('farren.salter@yahoo.com'),('ldsmith19@hotmail.com')) admins(email) on conflict do nothing;
insert into playbook_private.members(committee,email) select distinct 'raffle',lower(trim(email)) from public.committee_interest where status='complete' and committees ? 'raffle' and nullif(trim(email),'') is not null on conflict do nothing;
commit;
