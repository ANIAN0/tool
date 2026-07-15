-- Eve owns the durable message stream. This table stores only the app-level
-- ownership binding needed to authorize Eve session and stream routes.
create table if not exists public.agent_sessions (
  session_id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null check (agent_id in ('assistant', 'research')),
  created_at timestamptz not null default now()
);

alter table public.agent_sessions enable row level security;

revoke all on table public.agent_sessions from anon;
grant select on public.agent_sessions to authenticated;

create policy "Users can read their own agent session records"
on public.agent_sessions
for select
to authenticated
using ((select auth.uid()) = owner_id);

-- No client write policy: the Eve runtime uses the server-only service role
-- after it has verified the Supabase access token and mapped auth.uid().
