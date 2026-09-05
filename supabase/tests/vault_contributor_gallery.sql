begin;
set local role anon;
do $$
declare r jsonb; g jsonb; ids jsonb; n integer;
begin
 for r in select value from jsonb_array_elements(public.vault_contributors()) loop
  g := public.vault_contributor_gallery(r->>'owner');
  if (g->>'total')::int <> (r->>'uploads')::int then raise exception 'Contributor count mismatch'; end if;
  ids := '[]'::jsonb; n := 0;
  loop
   g := public.vault_contributor_gallery(r->>'owner',n);
   exit when jsonb_array_length(g->'ids')=0;
   ids := ids || (g->'ids'); n := n + jsonb_array_length(g->'ids');
  end loop;
  if n <> (r->>'uploads')::int then raise exception 'Pagination omitted uploads'; end if;
  if (select count(distinct value) from jsonb_array_elements_text(ids)) <> n then raise exception 'Duplicate uploads'; end if;
  if exists(select 1 from jsonb_array_elements_text(ids) i join public.vault_photos p on p.id=i.value::uuid join public.vault_events e on e.id=p.event_id where p.hidden or p.removed_at is not null or e.hidden) then raise exception 'Nonpublic upload exposed'; end if;
 end loop;
 if public.vault_contributor_gallery('missing-owner') is not null then raise exception 'Unknown contributor accepted'; end if;
end $$;
rollback;