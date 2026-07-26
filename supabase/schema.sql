-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)

create extension if not exists "uuid-ossp";

create table if not exists decks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  source_type text not null check (source_type in ('text', 'url', 'file')),
  difficulty text not null default 'basic' check (difficulty in ('basic', 'applied')),
  is_public boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists cards (
  id uuid primary key default uuid_generate_v4(),
  deck_id uuid references decks(id) on delete cascade not null,
  front text not null,
  back text not null,
  -- SM-2 spaced repetition fields
  interval integer not null default 0,
  ease_factor numeric not null default 2.5,
  repetitions integer not null default 0,
  next_review_date timestamptz not null default now(),
  created_at timestamptz default now()
);

create table if not exists quiz_questions (
  id uuid primary key default uuid_generate_v4(),
  deck_id uuid references decks(id) on delete cascade not null,
  question text not null,
  options jsonb not null, -- array of 4 strings
  correct_index integer not null check (correct_index between 0 and 3),
  explanation text not null,
  created_at timestamptz default now()
);

create table if not exists quiz_attempts (
  id uuid primary key default uuid_generate_v4(),
  deck_id uuid references decks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  score integer not null,
  total integer not null,
  attempted_at timestamptz default now()
);

create table if not exists study_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  cards_reviewed integer not null default 0,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- Row Level Security
alter table decks enable row level security;
alter table cards enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_attempts enable row level security;
alter table study_sessions enable row level security;

-- Decks Policies
create policy "Users can select public decks or their own" on decks
  for select using (is_public = true or auth.uid() = user_id);

create policy "Users can insert their own decks" on decks
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own decks" on decks
  for update using (auth.uid() = user_id);

create policy "Users can delete their own decks" on decks
  for delete using (auth.uid() = user_id);

-- Cards Policies
create policy "Users can view cards of public decks or their own" on cards
  for select using (
    deck_id in (select id from decks where is_public = true or user_id = auth.uid())
  );

create policy "Users can modify cards in their own decks" on cards
  for all using (
    deck_id in (select id from decks where user_id = auth.uid())
  );

-- Quiz Questions Policies
create policy "Users can view quiz questions of public decks or their own" on quiz_questions
  for select using (
    deck_id in (select id from decks where is_public = true or user_id = auth.uid())
  );

create policy "Users can modify quiz questions in their own decks" on quiz_questions
  for all using (
    deck_id in (select id from decks where user_id = auth.uid())
  );

-- Quiz Attempts Policies
create policy "Users manage their own quiz attempts" on quiz_attempts
  for all using (auth.uid() = user_id);

-- Study Sessions Policies
create policy "Users manage their own study sessions" on study_sessions
  for all using (auth.uid() = user_id);

create index if not exists idx_cards_next_review on cards(deck_id, next_review_date);
create index if not exists idx_study_sessions_user_date on study_sessions(user_id, date);
