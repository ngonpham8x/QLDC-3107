-- Run this migration in the Supabase SQL Editor before importing data.
-- Data remains private: no anon/authenticated policies are created.

create table if not exists public.app_records (
  collection_name text not null,
  record_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection_name, record_id)
);

create index if not exists app_records_collection_name_idx
  on public.app_records (collection_name);

create or replace function public.set_app_records_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_records_set_updated_at on public.app_records;
create trigger app_records_set_updated_at
before update on public.app_records
for each row execute function public.set_app_records_updated_at();

alter table public.app_records enable row level security;
revoke all on public.app_records from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.app_records to service_role;
