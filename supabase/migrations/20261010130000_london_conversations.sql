create table public.london_reactions (
 photo_id uuid not null references public.m3_photos(id),
 owner text not null,
 reaction text not null check(reaction in ('love','celebrate','thanks')),
 primary key(photo_id,owner,reaction)
);
alter table public.london_reactions enable row level security;
revoke all on public.london_reactions from anon,authenticated;
create or replace function public.london_conversation(p_photo uuid,p_token text,p_action text default 'read',p_body text default '',p_name text default '',p_reaction text default '',p_comment uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o text; result jsonb;
begin
 if length(coalesce(p_token,''))<32 then raise exception 'A sharing token is required'; end if;
 o:=public.m3_hash(p_token);
 if not exists(select 1 from public.m3_list_photos(p_token=>p_token,p_vault=>'london-2028',p_mode=>'recent',p_limit=>5000) v where (v.photo).id=p_photo) then raise exception 'This moment is no longer available'; end if;
 if p_action='react' then
  if p_reaction not in ('love','celebrate','thanks') then raise exception 'Choose a positive reaction'; end if;
  if exists(select 1 from public.london_reactions where photo_id=p_photo and owner=o and reaction=p_reaction) then
   delete from public.london_reactions where photo_id=p_photo and owner=o and reaction=p_reaction;
  else insert into public.london_reactions values(p_photo,o,p_reaction) on conflict do nothing; end if;
 elsif p_action='comment' then
  if length(trim(p_body)) not between 1 and 500 or length(trim(p_name)) not between 1 and 60 then raise exception 'Add your name and a comment, up to 500 characters'; end if;
  if (select count(*) from public.m3_comments where owner=o and created_at>now()-interval '1 hour')>=60 then raise exception 'Please wait before adding more comments'; end if;
  insert into public.m3_comments(photo_id,owner,author_name,body) values(p_photo,o,trim(p_name),trim(p_body));
 elsif p_action='remove' then
  update public.m3_comments set hidden=true where id=p_comment and photo_id=p_photo and owner=o;
 elsif p_action<>'read' then raise exception 'Unknown action'; end if;
 select jsonb_build_object(
  'reactions',coalesce((select jsonb_agg(x) from(select reaction,count(*) as count,bool_or(owner=o) as mine from public.london_reactions where photo_id=p_photo group by reaction)x),'[]'::jsonb),
  'comments',coalesce((select jsonb_agg(x order by x.created_at) from(select id,author_name,body,created_at,owner=o as mine from public.m3_comments where photo_id=p_photo and not hidden order by created_at limit 500)x),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.london_conversation(uuid,text,text,text,text,text,uuid) from public;
grant execute on function public.london_conversation(uuid,text,text,text,text,text,uuid) to anon,authenticated;
