-- ─── STUDENT PROFILES ────────────────────────────────────────────────
-- Extends auth.users with school-specific metadata.
-- is_active = false blocks login via middleware.
create table student_profiles (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  full_name                text not null default '',
  parent_email             text,
  parent_telegram_chat_id  text,   -- Telegram chat_id for sending invoices/receipts
  notes                    text,
  is_active                boolean not null default true,
  created_by               uuid references auth.users(id),
  created_at               timestamptz not null default now()
);
alter table student_profiles enable row level security;
create policy "Admin full access on student_profiles" on student_profiles
  using (true)
  with check (true);
create policy "Student reads own profile" on student_profiles
  for select using (auth.uid() = user_id);

-- ─── CLASSES ─────────────────────────────────────────────────────────
create table classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);
alter table classes enable row level security;
create policy "Admin full access on classes" on classes
  using (true)
  with check (true);

-- ─── CLASS MEMBERSHIPS ───────────────────────────────────────────────
create table class_members (
  class_id   uuid not null references classes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (class_id, user_id)
);
alter table class_members enable row level security;
create policy "Admin full access on class_members" on class_members
  using (true)
  with check (true);

-- ─── CLASS SCHEDULES ─────────────────────────────────────────────────
-- One row per weekly time slot. day_of_week: 0=Sun … 6=Sat.
create table class_schedules (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references classes(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  start_time   time not null,
  duration_min smallint not null default 60,
  label        text
);
alter table class_schedules enable row level security;
create policy "Admin full access on class_schedules" on class_schedules
  using (true)
  with check (true);

-- ─── INVOICES ────────────────────────────────────────────────────────
create table invoices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  amount_cents  integer not null check (amount_cents > 0),
  description   text not null,
  due_date      date not null,
  status        text not null default 'unpaid' check (status in ('unpaid', 'paid', 'void')),
  sent_at       timestamptz,
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);
alter table invoices enable row level security;
create policy "Admin full access on invoices" on invoices
  using (true)
  with check (true);

-- ─── RECEIPT NUMBER SEQUENCE ─────────────────────────────────────────
create sequence receipt_number_seq start 1;

-- ─── RECEIPTS ────────────────────────────────────────────────────────
-- Immutable snapshot created when invoice is marked paid.
create table receipts (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references invoices(id),
  user_id        uuid not null references auth.users(id),
  amount_cents   integer not null,
  description    text not null,
  paid_at        timestamptz not null,
  receipt_number text not null unique
);
alter table receipts enable row level security;
create policy "Admin full access on receipts" on receipts
  using (true)
  with check (true);
