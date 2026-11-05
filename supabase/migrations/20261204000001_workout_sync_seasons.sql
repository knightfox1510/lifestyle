-- Workouts from Health Connect (so band/phone sessions count toward weekly
-- goals) and new-season checks for the watchlist.

-- "hc:<start ms>" for a session imported from Health Connect; null for ones logged in Hearth.
alter table public.workout_logs add column if not exists external_id text check (char_length(external_id) <= 80);
do $$ begin
  alter table public.workout_logs add constraint workout_logs_owner_external_key unique (owner_id, external_id);
exception when duplicate_object or duplicate_table then null;
end $$;

alter table public.watchlist_items add column if not exists latest_season smallint check (latest_season between 1 and 100);
alter table public.watchlist_items add column if not exists next_season text check (char_length(next_season) <= 80);
alter table public.watchlist_items add column if not exists seasons_checked_at timestamptz;
