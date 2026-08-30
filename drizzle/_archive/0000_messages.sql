create table messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index messages_project_id_created_at_idx on messages (project_id, created_at asc);
alter table messages enable row level security;
create policy "Users can read own messages" on messages for select using (auth.uid() = user_id);
