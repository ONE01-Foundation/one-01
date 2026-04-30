create table if not exists public.providers (
  id text primary key,
  name text not null,
  type text not null,
  location text not null,
  "priceRange" text not null,
  rating numeric(3,2) not null default 0,
  "availabilityText" text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists providers_type_location_idx
  on public.providers (type, location);

insert into public.providers (id, name, type, location, "priceRange", rating, "availabilityText", metadata)
values
  ('drv_tlv_1', 'Yossi Drive School', 'driving_teacher', 'Tel Aviv', '₪₪', 4.8, 'Next slot: Tue 17:00', '{"languages":["he","en"],"car":"automatic"}'::jsonb),
  ('drv_tlv_2', 'Maya Driving Coach', 'driving_teacher', 'Tel Aviv', '₪₪₪', 4.7, 'Next slot: Wed 09:00', '{"languages":["he"],"car":"manual"}'::jsonb),
  ('drv_hfa_1', 'North Road Academy', 'driving_teacher', 'Haifa', '₪₪', 4.6, 'Next slot: Mon 14:30', '{"languages":["he","ru"],"car":"automatic"}'::jsonb)
on conflict (id) do update
set
  name = excluded.name,
  type = excluded.type,
  location = excluded.location,
  "priceRange" = excluded."priceRange",
  rating = excluded.rating,
  "availabilityText" = excluded."availabilityText",
  metadata = excluded.metadata;
