-- ---------------------------------------------------------------------------
-- 20260828150100_ami_vault_seed.sql — first admin, the 2026-27 timeline, and
-- the opening "photos wanted" requests.
--
-- Dates come from the Amistad Event Calendar (Zyan Wynn) and the RCA
-- 2026-2027 All School Calendar as of Aug 28, 2026. Everything here is
-- editable from /ami-vault/#/admin afterwards; this just means the vault is
-- not empty on day one.
-- ---------------------------------------------------------------------------

insert into public.vault_admins (user_id, note)
select id, 'Mose James — RCAP chair, vault owner'
from auth.users where email = 'mose@mosejames.com'
on conflict (user_id) do nothing;

insert into public.vault_events (house, slug, title, blurb, kind, starts_on, ends_on, featured) values
  ('amistad', 'everyday-amistad',       'Everyday Amistad',              'Carline, homework, hallway moments, the small stuff that becomes the big stuff. No event required.', 'everyday',  '2026-08-26', '2027-05-28', false),
  ('amistad', 'leadership-retreat',     'Ami Leadership Retreat',        'Where the year got planned.', 'house',     '2026-08-03', null, false),
  ('amistad', 'new-parent-orientation', 'New Parent Orientation',        '', 'school',    '2026-08-20', null, false),
  ('amistad', 'first-day-of-school',    'First Day of School',           'Everybody took one at the front door. Every single one belongs here.', 'milestone', '2026-08-26', null, true),
  ('amistad', 'afterhours',             'AMI AfterHours',                'Quick food, fellowship, and the first-day celebration.', 'house',     '2026-08-26', null, false),
  ('amistad', 'welcome-party',          'AMI Welcome Party',             'The house, together, for the first time this year.', 'house',     '2026-08-29', null, true),
  ('amistad', 'sparkles-takeover',      'RCA Takeover at Sparkles',      'All four houses on wheels.', 'house',     '2026-09-04', null, false),
  ('amistad', 'bingo-night-fall',       'Bingo Night',                   '', 'school',    '2026-09-15', null, false),
  ('amistad', 'open-house-sept',        'Open House',                    '', 'school',    '2026-09-17', null, false),
  ('amistad', 'picture-day',            'Picture Day',                   'The official one is coming. This is the outtakes.', 'school',    '2026-09-29', null, false),
  ('amistad', 'knight-shift-lock-in',   'The Knight Shift Lock-In',      'An overnight in the building.', 'house',     '2026-10-02', '2026-10-03', false),
  ('amistad', 'london-trip',            '7th Grade London Trip',         '', 'trip',      '2026-10-11', '2026-10-18', false),
  ('amistad', 'savannah-trip',          '8th Grade Savannah Trip',       '', 'trip',      '2026-10-14', '2026-10-16', false),
  ('amistad', 'nyc-trip',               '6th Grade NYC Trip',            '', 'trip',      '2026-10-21', '2026-10-23', false),
  ('amistad', 'service-project',        'Ami Service Project',           '', 'house',     '2026-11-07', null, false),
  ('amistad', 'dc-trip',                '5th Grade DC Trip',             '', 'trip',      '2026-11-08', '2026-11-10', false),
  ('amistad', 'rnb-lounge',             'The R&B Lounge',                'The Ami and Rismo parent party.', 'house',     '2026-11-14', null, false),
  ('amistad', 'monopoly-day',           'Monopoly Day',                  '', 'school',    '2026-11-17', null, false),
  ('amistad', 'robotics',               'RCA Robotics Competition',      '', 'school',    '2026-12-05', null, false),
  ('amistad', 'holiday-hangout',        'Ami/Bindi Holiday Hangout',     '', 'house',     '2026-12-09', null, false),
  ('amistad', 'homecoming-week',        'Homecoming Week',               '', 'school',    '2026-12-14', '2026-12-18', false),
  ('amistad', 'family-holiday-lunch',   'Family Holiday Lunch',          'Plus the homecoming and alumni event.', 'school',    '2026-12-18', null, false),
  ('amistad', 'mlk-day-of-service',     'Ami MLK Day of Service',        '', 'house',     '2027-01-18', null, false),
  ('amistad', 'utah-trip',              '7th Grade Utah Trip',           '', 'trip',      '2027-01-23', '2027-01-26', false),
  ('amistad', 'eighth-grade-trip',      '8th Grade Trip',                '', 'trip',      '2027-01-30', '2027-02-06', false),
  ('amistad', 'trivia-night',           'Trivia Night',                  '', 'school',    '2027-02-03', null, false),
  ('amistad', 'amazing-shake',          'The Amazing Shake',             '', 'school',    '2027-02-09', null, false),
  ('amistad', 'valentines',             'Ami Valentine''s Day',          '', 'house',     '2027-02-12', null, false),
  ('amistad', 'ami-fest',               'AMI Fest',                      '', 'house',     '2027-03-06', null, false),
  ('amistad', 'global-amazing-shake',   'Global Amazing Shake',          '', 'school',    '2027-03-18', '2027-03-20', false),
  ('amistad', 'families-competition',   'Ami fAMIlies Competition Day',  '', 'house',     '2027-04-16', null, false),
  ('amistad', 'talent-show',            'RCA Talent Show',               '', 'school',    '2027-05-08', null, false),
  ('amistad', 'eoy-celebration',        'AMI End of Year Celebration',   'Awards, and the last time this exact house is in one room.', 'house',     '2027-05-22', null, false),
  ('amistad', 'field-day',              'Field Day',                     '', 'school',    '2027-05-25', null, false),
  ('amistad', 'awards-night',           'Awards Night',                  '', 'school',    '2027-05-26', null, false),
  ('amistad', 'graduation',             'Graduation',                    '', 'milestone', '2027-05-28', null, false)
on conflict (house, slug) do nothing;

-- The first three asks. Each one shows on the home page with a live count
-- until it closes or the due date passes.
insert into public.vault_requests (house, event_id, message, goal, due_on)
select 'amistad', e.id, r.message, r.goal, r.due_on::date
from (values
  ('first-day-of-school', 'Everyone took one at the front door. Drop yours in.', 60, '2026-09-06'),
  ('welcome-party',       'Saturday at 1. Take a few, add them Sunday.',          40, '2026-09-08'),
  ('afterhours',          'Anyone who stayed for food: we want the pictures.',   20, '2026-09-06')
) as r(slug, message, goal, due_on)
join public.vault_events e on e.house = 'amistad' and e.slug = r.slug
where not exists (select 1 from public.vault_requests q where q.event_id = e.id);
