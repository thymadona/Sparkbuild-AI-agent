-- Per-class lesson toggle. Presence of a row = that week is turned off for
-- that class; absence = available (the current, pre-existing behavior for
-- every class). This is deliberately an opt-out table rather than an
-- opt-in one with a boolean column, so shipping this migration changes
-- nothing for any class until a teacher/admin explicitly disables a week —
-- no backfill needed, nothing regresses on deploy.

create table class_disabled_lessons (
  class_id    uuid not null references classes(id) on delete cascade,
  lesson_id   smallint not null check (lesson_id > 0),
  disabled_by uuid references auth.users(id) on delete set null,
  disabled_at timestamptz not null default now(),
  primary key (class_id, lesson_id)
);
alter table class_disabled_lessons enable row level security;
create policy "Admin full access on class_disabled_lessons" on class_disabled_lessons
  using (true)
  with check (true);
