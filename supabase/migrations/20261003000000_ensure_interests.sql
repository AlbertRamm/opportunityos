-- Idempotent repair for the interests reference table. Safe to run any number of times, on any project
-- state. Fixes an empty "What are you interested in?" list on /onboarding: ensures the 16 interests exist,
-- are active, and that signed-in/anonymous users can read them. Existing rows' labels/order are kept.

insert into public.interests (slug, label, sort_order) values
  ('electrical_engineering', 'Electrical Engineering', 10),
  ('computer_engineering',   'Computer Engineering',   20),
  ('computer_science',       'Computer Science',       30),
  ('semiconductors',         'Semiconductor / Chips',  40),
  ('mechanical_engineering', 'Mechanical Engineering', 50),
  ('civil_engineering',      'Civil Engineering',      60),
  ('aerospace',              'Aerospace',              70),
  ('biology_medicine',       'Biology / Medicine',     80),
  ('chemistry',              'Chemistry',              90),
  ('environment_climate',    'Environmental / Climate',100),
  ('business',               'Business',              110),
  ('finance',                'Finance',               120),
  ('government_policy',      'Government / Public Policy', 130),
  ('arts_design',            'Arts / Design',         140),
  ('education',              'Education',             150),
  ('other',                  'Other',                 999)
on conflict (slug) do nothing;

update public.interests set active = true
 where slug in ('electrical_engineering','computer_engineering','computer_science','semiconductors',
   'mechanical_engineering','civil_engineering','aerospace','biology_medicine','chemistry','environment_climate',
   'business','finance','government_policy','arts_design','education','other') and active is not true;

alter table public.interests enable row level security;
grant select on public.interests to anon, authenticated;
drop policy if exists interests_read on public.interests;
create policy interests_read on public.interests for select to anon, authenticated using (true);
