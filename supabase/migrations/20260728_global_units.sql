-- Global Units library: canonical, forkable units (the "TikTok sound / Wikipedia
-- page" model). Public read; writes only via SECURITY DEFINER RPCs (anon-safe,
-- same pattern as the shared marketplace). Applied to project dkkxecnfqkcpjjapbesy.

create table if not exists public.global_units (
  id uuid primary key default gen_random_uuid(),
  topic_key text unique not null,
  title text not null,
  emoji text default '📌',
  type text,
  lang text default 'en',
  steps jsonb default '[]'::jsonb,
  metrics jsonb default '[]'::jsonb,
  insights jsonb default '[]'::jsonb,
  next_action text,
  cover_image text,
  uses int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.global_units enable row level security;
drop policy if exists global_units_read on public.global_units;
create policy global_units_read on public.global_units for select using (true);

-- Publish (or enrich) the canonical unit for a topic. Keeps the richer plan
-- (more steps) and backfills a missing cover.
create or replace function public.publish_global_unit(
  p_topic_key text, p_title text, p_emoji text, p_type text, p_lang text,
  p_steps jsonb, p_metrics jsonb, p_insights jsonb, p_next_action text, p_cover_image text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.global_units as g
    (topic_key, title, emoji, type, lang, steps, metrics, insights, next_action, cover_image)
  values
    (lower(trim(p_topic_key)), p_title, coalesce(nullif(p_emoji,''),'📌'), p_type, coalesce(nullif(p_lang,''),'en'),
     coalesce(p_steps,'[]'::jsonb), coalesce(p_metrics,'[]'::jsonb), coalesce(p_insights,'[]'::jsonb),
     p_next_action, p_cover_image)
  on conflict (topic_key) do update set
    title = case when jsonb_array_length(excluded.steps) > jsonb_array_length(g.steps) then excluded.title else g.title end,
    steps = case when jsonb_array_length(excluded.steps) > jsonb_array_length(g.steps) then excluded.steps else g.steps end,
    metrics = case when jsonb_array_length(excluded.metrics) > jsonb_array_length(g.metrics) then excluded.metrics else g.metrics end,
    insights = case when jsonb_array_length(excluded.insights) > jsonb_array_length(g.insights) then excluded.insights else g.insights end,
    next_action = coalesce(g.next_action, excluded.next_action),
    cover_image = coalesce(g.cover_image, excluded.cover_image),
    emoji = case when g.emoji is null or g.emoji = '📌' then excluded.emoji else g.emoji end,
    updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.search_global_units(p_q text, p_limit int default 12)
returns setof public.global_units language sql security definer set search_path = public as $$
  select * from public.global_units
  where p_q is null or p_q = '' or title ilike '%'||p_q||'%' or topic_key ilike '%'||p_q||'%'
  order by uses desc, updated_at desc
  limit greatest(1, least(coalesce(p_limit,12), 50));
$$;

create or replace function public.fork_global_unit(p_id uuid)
returns public.global_units language plpgsql security definer set search_path = public as $$
declare v_row public.global_units;
begin
  update public.global_units set uses = uses + 1 where id = p_id returning * into v_row;
  return v_row;
end $$;

grant execute on function public.publish_global_unit(text,text,text,text,text,jsonb,jsonb,jsonb,text,text) to anon, authenticated;
grant execute on function public.search_global_units(text,int) to anon, authenticated;
grant execute on function public.fork_global_unit(uuid) to anon, authenticated;
grant select on public.global_units to anon, authenticated;
