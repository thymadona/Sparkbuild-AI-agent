-- Extend messages role constraint to allow teacher feedback
alter table messages drop constraint if exists messages_role_check;
alter table messages add constraint messages_role_check
  check (role in ('user', 'assistant', 'teacher'));
-- Add submission status to projects (null = not submitted)
alter table projects
  add column if not exists submission_status text
  check (submission_status in ('submitted', 'approved', 'needs_work'));
