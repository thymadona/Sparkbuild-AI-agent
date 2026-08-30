alter table projects add column if not exists lesson_version integer;

create table lesson_progress (
  project_id uuid primary key references projects(id) on delete cascade,
  completed_task_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create index lesson_progress_updated_at_idx on lesson_progress(updated_at desc);

alter table lesson_progress enable row level security;
