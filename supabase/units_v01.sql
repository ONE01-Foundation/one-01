create table if not exists public.units (
  id text primary key,
  user_id text not null,
  type text not null,
  title text not null,
  status text not null check (status in ('draft', 'active', 'waiting', 'completed', 'cancelled')),
  primary_space jsonb not null default '{}'::jsonb,
  blocks jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists units_user_id_updated_at_idx
  on public.units (user_id, updated_at desc);

create index if not exists units_status_idx
  on public.units (status);
