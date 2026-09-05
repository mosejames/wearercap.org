-- Downloads deferred by the owner. No export jobs or stored files were created.
drop policy vault_exports_read on storage.objects;
drop policy vault_exports_insert on storage.objects;
drop policy vault_exports_delete on storage.objects;
drop function public.vault_export_estimate(uuid[],boolean);
drop function public.vault_export_create(uuid[],boolean);
drop function public.vault_export_list();
drop function public.vault_export_cancel(uuid);
drop function public.vault_export_claim();
drop function public.vault_export_progress(uuid,uuid,integer,jsonb,boolean,text);
drop function public.vault_export_cleanup();
drop function vault_private.export_access(text,boolean);
drop function vault_private.export_worker();
drop table vault_private.exports;
drop table vault_private.export_config;
-- The empty private bucket is inert: no policies, jobs, credentials, or worker remain.
