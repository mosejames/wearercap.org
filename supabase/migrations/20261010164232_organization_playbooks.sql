begin;
alter table playbook_private.committees drop constraint committees_id_check;
alter table playbook_private.committees add constraint committees_id_check check(id in ('marcom','men','trunk','raffle','uniform','exec','advisory'));
insert into playbook_private.committees(id,name,folder_id,doc_id,record_id) values
('exec','RCAP Executive Board','1LucB19GjG9Y75hG6F7HZg0VSK-ccpjpk','1cms_kUBd5DYrII_hq9nRTwDT6dhnLw4_UZNTVUrAyHc','1WxvNU0W0WaX0SN6EnET-NXsh1G9uKhxTSjfQCVbOFpw'),
('advisory','RCAP Advisory Board','1n6kyw21KrHCTssIDZFQCil04ZDU3oLBE','1subapYGkFV9XjfY6m-Fc9kfWbqADnjbOiBMoxGQfcII','1BH_S2gPNK49Fq7xrr8oHMJuPxVhIxy69BWxe5ejcP8U');
-- Membership remains explicit per workspace. Global admins can assign leads and invite members.
commit;
