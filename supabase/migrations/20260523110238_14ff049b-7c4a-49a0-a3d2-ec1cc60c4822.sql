create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Users view own push subs"
  on public.push_subscriptions for select
  to authenticated using (auth.uid() = user_id);

create policy "Users insert own push subs"
  on public.push_subscriptions for insert
  to authenticated with check (auth.uid() = user_id);

create policy "Users update own push subs"
  on public.push_subscriptions for update
  to authenticated using (auth.uid() = user_id);

create policy "Users delete own push subs"
  on public.push_subscriptions for delete
  to authenticated using (auth.uid() = user_id);

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);