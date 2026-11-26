-- QuizRush schema.
-- All reads/writes go through the Next.js API with the service_role key.
-- RLS is enabled with no policies, so the anon key (used by browsers only for
-- Realtime) cannot touch these tables.

create type public.game_status as enum ('lobby', 'question', 'reveal', 'leaderboard', 'finished');

-- Quizzes. Questions live in a jsonb array so a save is a single atomic UPDATE.
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  description text not null default '',
  cover_image_url text,
  questions jsonb not null default '[]'::jsonb,
  edit_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  pin text not null check (pin ~ '^[0-9]{6}$'),
  quiz_id uuid references public.quizzes (id) on delete set null,
  -- Copy of the quiz at game creation: editing the quiz never affects a live game.
  quiz_snapshot jsonb not null,
  host_token_hash text not null,
  status public.game_status not null default 'lobby',
  current_question_index int not null default -1,
  -- When answering opens for the current question.
  question_started_at timestamptz,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- A PIN is unique among games that are still running.
create unique index games_active_pin_idx on public.games (pin) where status <> 'finished';
create index games_pin_created_idx on public.games (pin, created_at desc);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  nickname text not null,
  avatar text not null,
  token_hash text not null unique,
  score int not null default 0,
  streak int not null default 0,
  kicked boolean not null default false,
  joined_at timestamptz not null default now()
);

create unique index players_game_nickname_idx on public.players (game_id, lower(nickname));
create index players_game_idx on public.players (game_id);

create table public.answers (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  question_index int not null,
  answer jsonb not null,
  is_correct boolean not null,
  points int not null,
  response_ms int not null,
  created_at timestamptz not null default now(),
  -- One answer per player per question: the first one wins.
  unique (player_id, question_index)
);

create index answers_game_question_idx on public.answers (game_id, question_index);

alter table public.quizzes enable row level security;
alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.answers enable row level security;

revoke all on public.quizzes, public.games, public.players, public.answers from anon, authenticated;
grant all on public.quizzes, public.games, public.players, public.answers to service_role;

-- Closes the current question and adds its points to every player, atomically.
-- Returns false (and changes nothing) if the game is not on that open question,
-- which makes double clicks / duplicate requests harmless.
create or replace function public.reveal_question(p_game_id uuid, p_index int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.games
     set status = 'reveal'
   where id = p_game_id
     and status = 'question'
     and current_question_index = p_index;

  if not found then
    return false;
  end if;

  update public.players p
     set score = p.score + coalesce(a.points, 0),
         streak = case when coalesce(a.is_correct, false) then p.streak + 1 else 0 end
    from public.players p2
    left join public.answers a
      on a.player_id = p2.id
     and a.question_index = p_index
   where p.id = p2.id
     and p2.game_id = p_game_id;

  return true;
end;
$$;

revoke execute on function public.reveal_question(uuid, int) from public, anon, authenticated;
grant execute on function public.reveal_question(uuid, int) to service_role;

-- Public image bucket. Uploads happen only through signed upload URLs issued by
-- the API after checking the quiz edit token, so no storage policies are needed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quiz-images',
  'quiz-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;
