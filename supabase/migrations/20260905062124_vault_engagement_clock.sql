-- Monthly scores use server time, never a date supplied by the browser.
create function vault_private.stamp_like() returns trigger language plpgsql set search_path='' as $$
begin new.created_at:=now(); return new; end $$;
revoke all on function vault_private.stamp_like() from public;
create trigger vault_like_clock before insert on public.vault_likes for each row execute function vault_private.stamp_like();
