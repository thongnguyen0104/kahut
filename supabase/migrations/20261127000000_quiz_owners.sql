-- Quizzes now belong to a Supabase Auth account instead of a secret edit link.
-- Only signed-in accounts (created by a superadmin) can create and edit quizzes;
-- a superadmin (auth.users.raw_app_meta_data.role = 'superadmin') can see all of them.

alter table public.quizzes
  add column owner_id uuid references auth.users (id) on delete set null,
  add column owner_email text,
  add column question_count int generated always as (jsonb_array_length(questions)) stored;

-- Secret edit links are gone.
alter table public.quizzes drop column edit_token_hash;

create index quizzes_owner_updated_idx on public.quizzes (owner_id, updated_at desc);
create index quizzes_updated_idx on public.quizzes (updated_at desc);
