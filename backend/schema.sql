-- Number Rush scores. Run this whole file in the Supabase SQL editor; it is safe to run again.
-- Only the backend (service-role key) touches these tables: RLS is on with no policies.

create extension if not exists pgcrypto;

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  username text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists players_username_lower_key on players (lower(username));
alter table players enable row level security;

-- Per game mode: scores_<mode> is each player's top 10, leaderboard_<mode> is the overall top 25.
do $$
declare
  m text;
begin
  foreach m in array array['addition', 'mixed', 'challenge'] loop
    execute format(
      'create table if not exists %I (
         id bigint generated always as identity primary key,
         player_id uuid not null references players(id) on delete cascade,
         score integer not null check (score > 0),
         created_at timestamptz not null default now()
       )', 'scores_' || m);
    execute format('create index if not exists %I on %I (player_id, score desc)', 'scores_' || m || '_player_idx', 'scores_' || m);
    execute format('alter table %I enable row level security', 'scores_' || m);

    execute format(
      'create table if not exists %I (
         id bigint generated always as identity primary key,
         player_id uuid not null references players(id) on delete cascade,
         score integer not null check (score > 0),
         created_at timestamptz not null default now()
       )', 'leaderboard_' || m);
    execute format('create index if not exists %I on %I (score desc)', 'leaderboard_' || m || '_score_idx', 'leaderboard_' || m);
    execute format('alter table %I enable row level security', 'leaderboard_' || m);
  end loop;
end $$;

-- Adds a finished run to the player's top 10. Returns true when it made the list.
create or replace function submit_score(p_mode text, p_username text, p_score integer)
returns boolean
language plpgsql
as $$
declare
  v_player uuid;
  v_table text;
  v_count integer;
  v_min integer;
begin
  if p_mode not in ('addition', 'mixed', 'challenge') then
    raise exception 'invalid mode' using errcode = '22023';
  end if;
  if p_score is null or p_score < 1 then
    raise exception 'invalid score' using errcode = '22023';
  end if;
  v_table := 'scores_' || p_mode;

  -- Lock the player row so two runs finishing together cannot both skip the trim.
  select id into v_player from players where lower(username) = lower(p_username) for update;
  if v_player is null then
    raise exception 'unknown player' using errcode = 'P0002';
  end if;

  execute format('select count(*), min(score) from %I where player_id = $1', v_table)
    into v_count, v_min using v_player;
  if v_count >= 10 and p_score <= v_min then
    return false;
  end if;

  execute format('insert into %I (player_id, score) values ($1, $2)', v_table) using v_player, p_score;
  execute format(
    'delete from %1$I where id in (
       select id from %1$I where player_id = $1 order by score desc, id asc offset 10)', v_table)
    using v_player;
  return true;
end $$;

-- Adds a score to the overall top 25. The score MUST already be in the player's own top 10.
-- Returns true when it made the board.
create or replace function submit_leaderboard(p_mode text, p_username text, p_score integer)
returns boolean
language plpgsql
as $$
declare
  v_player uuid;
  v_scores text;
  v_board text;
  v_count integer;
  v_min integer;
  v_owned boolean;
begin
  if p_mode not in ('addition', 'mixed', 'challenge') then
    raise exception 'invalid mode' using errcode = '22023';
  end if;
  if p_score is null or p_score < 1 then
    raise exception 'invalid score' using errcode = '22023';
  end if;
  v_scores := 'scores_' || p_mode;
  v_board := 'leaderboard_' || p_mode;

  select id into v_player from players where lower(username) = lower(p_username);
  if v_player is null then
    raise exception 'unknown player' using errcode = 'P0002';
  end if;

  execute format('select exists (select 1 from %I where player_id = $1 and score = $2)', v_scores)
    into v_owned using v_player, p_score;
  if not v_owned then
    raise exception 'score not in the player''s top 10' using errcode = '22023';
  end if;

  -- One writer per mode at a time, so the board can never end up over 25 rows.
  perform pg_advisory_xact_lock(hashtext(v_board));

  execute format('select count(*), min(score) from %I', v_board) into v_count, v_min;
  if v_count >= 25 and p_score <= v_min then
    return false;
  end if;

  execute format('insert into %I (player_id, score) values ($1, $2)', v_board) using v_player, p_score;
  execute format(
    'delete from %1$I where id in (
       select id from %1$I order by score desc, id asc offset 25)', v_board);
  return true;
end $$;

revoke execute on function submit_score(text, text, integer) from public, anon, authenticated;
revoke execute on function submit_leaderboard(text, text, integer) from public, anon, authenticated;

-- Newer Supabase projects do not grant new tables to service_role on their own, so the backend would
-- get "permission denied". Grant it exactly what the API needs.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function submit_score(text, text, integer) to service_role;
grant execute on function submit_leaderboard(text, text, integer) to service_role;
