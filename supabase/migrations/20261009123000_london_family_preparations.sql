-- Families begin the shared story before departure. The album stays open
-- throughout and after the trip, using the existing London R2-only constraint.
insert into public.m3_events (vault, slug, title, blurb, kind, starts_on, ongoing)
values ('london-2028', 'before-the-adventure', 'Before the adventure',
        'Packing, big questions and the excitement at home. Our first postcards start with our families.',
        'everyday', '2026-10-09', true)
on conflict (vault, slug) do nothing;
