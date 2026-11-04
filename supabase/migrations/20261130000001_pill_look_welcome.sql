-- How each medicine / supplement looks (shape and colour), so they're easy to
-- tell apart in the schedule; and when someone finished the welcome steps.
alter table public.medicines add column if not exists pill_shape text check (pill_shape in ('round', 'oval', 'capsule', 'softgel', 'liquid', 'sachet', 'injection', 'drops', 'inhaler'));
alter table public.medicines add column if not exists pill_color text check (pill_color in ('white', 'yellow', 'orange', 'pink', 'red', 'purple', 'blue', 'green', 'brown', 'grey'));
alter table public.supplements add column if not exists pill_shape text check (pill_shape in ('round', 'oval', 'capsule', 'softgel', 'liquid', 'sachet', 'injection', 'drops', 'inhaler'));
alter table public.supplements add column if not exists pill_color text check (pill_color in ('white', 'yellow', 'orange', 'pink', 'red', 'purple', 'blue', 'green', 'brown', 'grey'));

alter table public.profiles add column if not exists welcome_done_at timestamptz;
