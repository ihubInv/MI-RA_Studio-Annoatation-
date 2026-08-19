-- Run once in Supabase SQL Editor (Dashboard → SQL → New query)

create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- Optional: create a public storage bucket for media (if using Supabase Storage)
-- insert into storage.buckets (id, name, public)
-- values ('mira-studio', 'mira-studio', false)
-- on conflict do nothing;
