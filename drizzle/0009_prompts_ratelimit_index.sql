create index if not exists prompts_user_id_created_at_idx
  on prompts (user_id, created_at);
