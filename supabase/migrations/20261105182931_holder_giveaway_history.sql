-- Explicit deny policies document that only the verified private functions
-- may access recipient data. No direct client read or write is permitted.
create policy server_only on ue_private.giveaways for all to anon,authenticated using(false) with check(false);
create policy server_only on ue_private.action_receipts for all to anon,authenticated using(false) with check(false);
