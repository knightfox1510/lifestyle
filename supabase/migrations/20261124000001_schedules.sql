-- How often: medicines and supplements can repeat every N days (weekly =
-- one weekday, fortnightly = every 14 days, monthly D3 60K = every 30 days…),
-- supplements can also be on chosen weekdays. Each person can set the clock
-- time for supplement timings (morning, with a meal, bedtime…).
alter table public.medicines
  add column if not exists repeat_every_days smallint;
do $$ begin
  alter table public.medicines add constraint medicines_repeat_every_days_check check (repeat_every_days between 2 and 365);
exception when duplicate_object then null; end $$;

alter table public.supplements
  add column if not exists days_of_week smallint[],
  add column if not exists repeat_every_days smallint,
  add column if not exists schedule_start date;
update public.supplements set schedule_start = (created_at at time zone 'Asia/Kolkata')::date where schedule_start is null;
alter table public.supplements alter column schedule_start set default current_date;
do $$ begin
  alter table public.supplements add constraint supplements_repeat_every_days_check check (repeat_every_days between 2 and 365);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.supplements add constraint supplements_days_of_week_check check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] and cardinality(days_of_week) between 1 and 7);
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists supplement_times jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.profiles add constraint profiles_supplement_times_object check (jsonb_typeof(supplement_times) = 'object');
exception when duplicate_object then null; end $$;
