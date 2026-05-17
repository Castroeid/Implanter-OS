-- Supabase schema for Implanter OS multi-user support
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user','manager','admin')),
  organization_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists meetings (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid,
  clientName text,
  meetingDate text,
  meetingType text,
  transcript text,
  transcriptPreview text,
  analysis jsonb,
  taskCheckboxStates jsonb,
  taskStatuses jsonb,
  createdAt timestamptz,
  updatedAt timestamptz
);

create table if not exists tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid,
  title text,
  description text,
  clientName text,
  meetingDate text,
  meetingId uuid,
  owner text,
  priority text,
  status text,
  source text,
  sourceType text,
  dueDate text,
  notes text,
  createdAt timestamptz,
  updatedAt timestamptz
);

create table if not exists weekly_report_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid,
  recipientEmail text,
  sendDay text,
  sendTime text,
  enabled boolean default true,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table meetings enable row level security;
alter table tasks enable row level security;
alter table weekly_report_settings enable row level security;

create policy "profile_owner" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "meetings_owner" on meetings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_owner" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weekly_owner" on weekly_report_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
