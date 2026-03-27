-- Add ON DELETE CASCADE to projects and prompts so deleting an auth user
-- automatically removes all their data without needing manual ordering.

-- projects
alter table projects
  drop constraint if exists projects_user_id_fkey,
  add constraint projects_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

-- prompts
alter table prompts
  drop constraint if exists prompts_user_id_fkey,
  add constraint prompts_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
