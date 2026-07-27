-- Shared Units: a unit two or more people share and correspond inside. Each
-- shared unit gets a short code (the shareable link); anyone with the code joins
-- as a member and reads/writes the common thread. Public read; writes only via
-- SECURITY DEFINER RPCs (anon-safe, same pattern as global_units / marketplace).
-- Applied to project dkkxecnfqkcpjjapbesy.

create table if not exists public.shared_units (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  emoji text default '📌',
  type text,
  unit jsonb default '{}'::jsonb,        -- snapshot so late joiners get the plan
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_unit_members (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.shared_units(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (unit_id, name)
);

create table if not exists public.shared_unit_messages (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.shared_units(id) on delete cascade,
  author text not null,
  role text not null default 'human',    -- 'human' | 'one'
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists shared_unit_messages_unit_idx
  on public.shared_unit_messages(unit_id, created_at);

alter table public.shared_units enable row level security;
drop policy if exists shared_units_read on public.shared_units;
create policy shared_units_read on public.shared_units for select using (true);
alter table public.shared_unit_members enable row level security;
drop policy if exists shared_unit_members_read on public.shared_unit_members;
create policy shared_unit_members_read on public.shared_unit_members for select using (true);
alter table public.shared_unit_messages enable row level security;
drop policy if exists shared_unit_messages_read on public.shared_unit_messages;
create policy shared_unit_messages_read on public.shared_unit_messages for select using (true);

-- Create a shared unit from a snapshot; returns the row (with its code). The
-- creator is added as the first member.
create or replace function public.create_shared_unit(
  p_title text, p_emoji text, p_type text, p_unit jsonb, p_author text
) returns public.shared_units language plpgsql security definer set search_path = public as $$
declare v_row public.shared_units; v_code text;
begin
  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  insert into public.shared_units (code, title, emoji, type, unit, created_by)
  values (v_code, coalesce(nullif(trim(p_title), ''), 'Shared unit'),
          coalesce(nullif(p_emoji, ''), '📌'), p_type,
          coalesce(p_unit, '{}'::jsonb), nullif(trim(p_author), ''))
  returning * into v_row;
  if p_author is not null and trim(p_author) <> '' then
    insert into public.shared_unit_members (unit_id, name)
    values (v_row.id, trim(p_author)) on conflict do nothing;
  end if;
  return v_row;
end $$;

-- Join a shared unit by code (adds you as a member); returns the row, or NULL if
-- the code is unknown.
create or replace function public.join_shared_unit(p_code text, p_name text)
returns public.shared_units language plpgsql security definer set search_path = public as $$
declare v_row public.shared_units;
begin
  select * into v_row from public.shared_units where code = lower(trim(p_code));
  if v_row.id is null then return null; end if;
  if p_name is not null and trim(p_name) <> '' then
    insert into public.shared_unit_members (unit_id, name)
    values (v_row.id, trim(p_name)) on conflict (unit_id, name) do nothing;
  end if;
  return v_row;
end $$;

-- Poll the common thread — messages newer than p_since (NULL = all).
create or replace function public.get_shared_messages(p_code text, p_since timestamptz)
returns setof public.shared_unit_messages language sql security definer set search_path = public as $$
  select m.* from public.shared_unit_messages m
  join public.shared_units s on s.id = m.unit_id
  where s.code = lower(trim(p_code))
    and (p_since is null or m.created_at > p_since)
  order by m.created_at asc
  limit 500;
$$;

-- Post a message into the common thread (role 'human' or 'one').
create or replace function public.post_shared_message(
  p_code text, p_author text, p_role text, p_text text
) returns public.shared_unit_messages language plpgsql security definer set search_path = public as $$
declare v_unit uuid; v_row public.shared_unit_messages;
begin
  select id into v_unit from public.shared_units where code = lower(trim(p_code));
  if v_unit is null then return null; end if;
  insert into public.shared_unit_messages (unit_id, author, role, text)
  values (v_unit, coalesce(nullif(trim(p_author), ''), 'Someone'),
          case when p_role = 'one' then 'one' else 'human' end, p_text)
  returning * into v_row;
  update public.shared_units set updated_at = now() where id = v_unit;
  return v_row;
end $$;

-- Who's in the room.
create or replace function public.list_shared_members(p_code text)
returns setof public.shared_unit_members language sql security definer set search_path = public as $$
  select mem.* from public.shared_unit_members mem
  join public.shared_units s on s.id = mem.unit_id
  where s.code = lower(trim(p_code))
  order by mem.created_at asc;
$$;

grant execute on function public.create_shared_unit(text,text,text,jsonb,text) to anon, authenticated;
grant execute on function public.join_shared_unit(text,text) to anon, authenticated;
grant execute on function public.get_shared_messages(text,timestamptz) to anon, authenticated;
grant execute on function public.post_shared_message(text,text,text,text) to anon, authenticated;
grant execute on function public.list_shared_members(text) to anon, authenticated;
grant select on public.shared_units, public.shared_unit_members, public.shared_unit_messages to anon, authenticated;
