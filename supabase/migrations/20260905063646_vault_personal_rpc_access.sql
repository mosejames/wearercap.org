-- This project grants anon function execution by default. Personal endpoints
-- require both authenticated role access and the existing auth.uid() checks.
revoke all on function public.vault_my_activity(text,integer),public.vault_my_dashboard(),public.vault_my_rewards(),public.vault_claim_badges(),public.vault_avatar(boolean) from anon;
