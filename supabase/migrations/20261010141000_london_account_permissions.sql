-- Project default privileges also grant anon directly, independently of PUBLIC.
revoke execute on function public.london_claim_account(text) from anon;
revoke execute on function public.london_verified_owner() from anon;
