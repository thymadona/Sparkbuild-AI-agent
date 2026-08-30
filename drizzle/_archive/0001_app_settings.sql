create table app_settings (
  key   text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Build mode is OFF by default
insert into app_settings (key, value)
values ('build_mode_enabled', 'false'::jsonb);
