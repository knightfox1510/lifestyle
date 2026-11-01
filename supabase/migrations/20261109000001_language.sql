-- App language per person: English, Hindi or Marathi. Also used for AI
-- replies and notification text.
alter table public.profiles
  add column language text not null default 'en' check (language in ('en', 'hi', 'mr'));
