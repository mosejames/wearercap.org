alter table public.vault_events drop constraint vault_events_gallery_cards_check;
alter table public.vault_events add constraint vault_events_gallery_cards_check check (
 gallery_cards is null or gallery_cards <@ array[
 'upload-more-photos','karaoke-feedback','karaoke-sept-27','membership-2026',
 'karaoke-booth-gallery','karaoke-event-gallery','collective','suggestion-box',
 'georgia-goal','trunk-booth-gallery'
 ]::text[]
);
update public.vault_events
set gallery_cards = array(
 select distinct card from unnest(coalesce(gallery_cards,array['upload-more-photos']::text[])
 || array['georgia-goal','karaoke-feedback','trunk-booth-gallery']::text[]) as selected(card)
)
where house='rcap' and slug='rcap-trunk-or-treat-2026' and not hidden;
