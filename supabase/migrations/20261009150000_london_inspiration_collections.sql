-- One optional collection per photo. Captions remain free-form and media stays in R2.
alter table public.m3_photos add column inspiration text not null default '';
alter table public.m3_photos add constraint london_inspiration_valid check (
 inspiration = '' or (vault = 'london-2028' and inspiration in ('packing-bags', 'most-excited', 'dreaming-of-london', 'airport-hellos', 'window-seat', 'tower-of-london', 'fish-and-chips', 'london-dungeon', 'national-portrait-gallery', 'trafalgar-square', 'w-london', 'westminster-abbey', 'british-museum', 'madame-tussauds', 'six', 'hampton-court', 'stonehenge', 'wicked', 'train-to-paris', 'louvre', 'bistrot-de-la-montagne', 'eiffel-tower', 'paris-hotel', 'versailles', 'napoleons-tomb', 'notre-dame', 'seine-cruise', 'home-again', 'little-moments'))
);
create index london_photos_inspiration on public.m3_photos(inspiration) where vault = 'london-2028' and not hidden;
