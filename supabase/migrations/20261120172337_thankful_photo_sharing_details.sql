alter table public.thankful_messages
  add column student_or_family_name text check (char_length(student_or_family_name) <= 100),
  add column houses text[] not null default '{}' check (
    cardinality(houses) <= 4 and houses <@ array['Altruismo', 'Amistad', 'Isibindi', 'Rêveur']
  ),
  add column class_years text[] not null default '{}' check (
    cardinality(class_years) <= 5 and class_years <@ array['2027', '2028', '2029', '2030', '2031']
  );

grant insert (student_or_family_name, houses, class_years)
  on public.thankful_messages to anon, authenticated;
