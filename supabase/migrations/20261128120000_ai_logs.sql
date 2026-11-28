-- One row per AI quiz generation request (success or failure), shown to superadmins
-- at /admin/ai-logs. Written and read only by the server with the service_role key.

create table public.ai_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  user_email text,
  mode text not null check (mode in ('create', 'append')),
  quiz_id uuid,
  topic text not null,
  -- { types: [...], difficulty, language }
  settings jsonb not null default '{}'::jsonb,
  requested int not null,
  -- Questions in the model's answer, and how many passed validation.
  received int,
  generated int,
  ok boolean not null,
  error_code text,
  error_detail text,
  -- [{ model, ok, ms, status?, finishReason?, error?, inputTokens?, outputTokens? }]
  attempts jsonb not null default '[]'::jsonb,
  duration_ms int not null
);

create index ai_logs_created_idx on public.ai_logs (created_at desc);

-- RLS on with no policies: browsers (anon key) cannot read the log.
alter table public.ai_logs enable row level security;
