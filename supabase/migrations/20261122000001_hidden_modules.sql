-- Features each person has switched off for themselves (e.g. Gaurav hides the
-- cycle tracker). The household setting still decides what exists at all.
alter table public.profiles
  add column if not exists hidden_modules text[] not null default '{}';
do $$ begin
  alter table public.profiles add constraint profiles_hidden_modules_check check (cardinality(hidden_modules) <= 60);
exception when duplicate_object then null; end $$;
