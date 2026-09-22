-- Homework review is gone: no route or page checks this permission anymore
-- (former-homework tasks are now plain Bonus tasks, unreviewed).
delete from role_permissions where permission_id in (
  select id from permissions where key = 'homework:review'
);
delete from permissions where key = 'homework:review';
