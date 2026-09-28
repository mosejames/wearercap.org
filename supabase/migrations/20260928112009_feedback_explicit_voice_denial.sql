create or replace function feedback_private.voice_access(p_name text,p_write boolean) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v feedback_private.voices; headers jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb; secret text; org uuid;
begin
 select * into v from feedback_private.voices where id::text||'/recording'=p_name;
 if not found then return false; end if;
 if p_write then return not v.complete and v.created_at>now()-interval '1 hour' and coalesce(headers->>'x-feedback-token'=v.id::text,false); end if;
 secret:=headers->>'x-feedback-admin';
 if coalesce(public.vault_pass_ok('rcap',secret),false) then return v.complete; end if;
 org:=feedback_private.organizer(secret);
 return v.complete and v.permission='community' and org is not null and exists(select 1 from feedback_private.surveys where id=v.survey_id and organizer_id=org);
end $$;
