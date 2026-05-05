create table public.trading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_type text not null,
  pnl numeric not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  total_trades integer not null default 0,
  stake numeric,
  target_digit integer,
  repetition_count integer,
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.trading_sessions enable row level security;

create policy "own sessions select" on public.trading_sessions
  for select using (auth.uid() = user_id);
create policy "own sessions insert" on public.trading_sessions
  for insert with check (auth.uid() = user_id);
create policy "own sessions delete" on public.trading_sessions
  for delete using (auth.uid() = user_id);

create index trading_sessions_user_idx on public.trading_sessions(user_id, ended_at desc);