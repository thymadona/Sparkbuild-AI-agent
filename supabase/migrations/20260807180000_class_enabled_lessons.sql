-- Flips the per-class lesson toggle from opt-out to opt-in. The previous
-- migration (20260807170000_class_disabled_lessons.sql) shipped moments
-- ago with no real usage yet — safe to replace outright rather than adding
-- a second table. Never hand-edit an applied migration; this fixes forward.
--
-- New semantics: presence of a row = that week is OPEN for that class;
-- absence = locked. This is the opposite of the previous table on purpose
-- — the ask was "everything off by default, a teacher turns on each week."
--
-- Backfill below keeps every class that exists as of this migration fully
-- open (matches what students already had access to, so nobody loses
-- access to a week they could already reach). Classes created after this
-- migration start with zero rows — fully locked until a teacher/admin
-- opens each week.

begin;

drop table if exists class_disabled_lessons;

create table class_enabled_lessons (
  class_id    uuid not null references classes(id) on delete cascade,
  lesson_id   smallint not null check (lesson_id > 0),
  enabled_by  uuid references auth.users(id) on delete set null,
  enabled_at  timestamptz not null default now(),
  primary key (class_id, lesson_id)
);
alter table class_enabled_lessons enable row level security;
create policy "Admin full access on class_enabled_lessons" on class_enabled_lessons
  using (true)
  with check (true);

insert into class_enabled_lessons (class_id, lesson_id)
select c.id, w.lesson_id
from classes c
cross join (values (1), (2), (3), (4), (5), (6)) as w(lesson_id);

commit;
