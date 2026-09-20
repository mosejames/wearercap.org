begin;
-- Assertions use existing RSVP capabilities internally, never returning tokens.
do $$
declare ev uuid; tok uuid; rid uuid; n int; result jsonb;
begin
 select id into ev from public.events where slug='karaoke-sept-27';
 select id,token into rid,tok from public.event_rsvps where event_id=ev and status='going' order by created_at limit 1;
 if tok is null then raise exception 'Test requires an existing RSVP'; end if;
 select public.event_song_list('karaoke-sept-27') into result;
 if jsonb_array_length(result)<8 then raise exception 'Missing seed songs'; end if;
 if exists(select 1 from jsonb_array_elements(result) row, jsonb_object_keys(row) k where k in ('email','phone','token','full_name','rsvp_id')) then raise exception 'Private fields exposed'; end if;
 if has_table_privilege('anon','public.event_songs','select') or has_table_privilege('authenticated','public.event_songs','insert') then raise exception 'Direct table access granted'; end if;
 perform public.event_song_submit('karaoke-sept-27',tok,'  Playlist verification  ',' Test artist ');
 if not exists(select 1 from public.event_songs where rsvp_id=rid and title='Playlist verification' and artist='Test artist') then raise exception 'Submission not persisted/trimmed'; end if;
 begin
   perform public.event_song_submit('karaoke-sept-27',tok,'playlist verification','test ARTIST');
   raise exception 'Duplicate accepted';
 exception when raise_exception then if sqlerrm <> 'duplicate_song' then raise; end if; end;
 begin
   perform public.event_song_submit('karaoke-sept-27',tok,'Another track','Artist');
   raise exception 'Rate limit missing';
 exception when raise_exception then if sqlerrm <> 'slow_down' then raise; end if; end;
 begin
   perform public.event_song_submit('karaoke-sept-27',gen_random_uuid(),'Track','Artist');
   raise exception 'Invalid token accepted';
 exception when raise_exception then if sqlerrm <> 'rsvp_required' then raise; end if; end;
 begin
   perform public.event_song_submit('karaoke-sept-27',tok,'   ','Artist');
   raise exception 'Empty title accepted';
 exception when raise_exception then if sqlerrm <> 'invalid_song' then raise; end if; end;
 begin
   perform public.event_song_submit('karaoke-sept-27',tok,repeat('x',121),'Artist');
   raise exception 'Long title accepted';
 exception when raise_exception then if sqlerrm <> 'invalid_song' then raise; end if; end;
 update public.event_songs set hidden=true where rsvp_id=rid and title='Playlist verification';
 if exists(select 1 from jsonb_array_elements(public.event_song_list('karaoke-sept-27')) s where s->>'title'='Playlist verification') then raise exception 'Hidden song visible'; end if;
 update public.events set status='closed' where id=ev;
 begin
   perform public.event_song_submit('karaoke-sept-27',tok,'Track','Artist');
   raise exception 'Closed event accepted';
 exception when raise_exception then if sqlerrm <> 'event_closed' then raise; end if; end;
end $$;
set local role anon;
select jsonb_array_length(public.event_song_list('karaoke-sept-27')) as public_song_count;
rollback;
