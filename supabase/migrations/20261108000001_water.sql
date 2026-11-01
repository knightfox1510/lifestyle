-- Water reminders: per-person settings on notification preferences.
alter table public.notification_prefs
  add column water boolean not null default false,
  add column water_target_ml integer check (water_target_ml between 500 and 6000),
  add column water_interval_min smallint not null default 120 check (water_interval_min between 30 and 360),
  add column water_start time not null default '08:00',
  -- Last reminder of the day; default stops in the evening so drinking late
  -- doesn't add night-time bathroom trips or leaks.
  add column water_end time not null default '19:30';
