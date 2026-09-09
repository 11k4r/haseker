-- ============================================================================
-- Recommended Row Level Security policies for `polls` and `users`.
--
-- WHY THIS FILE MATTERS:
-- The original admin dashboard decided who was an admin entirely in the
-- browser (a `role` check in a useEffect). That check is cosmetic — anyone
-- can open the browser console and call `supabase.from('polls').insert(...)`
-- directly with their own anon-key session, completely bypassing the React
-- UI. The Server Actions in app/admin/actions.ts now re-check the caller's
-- role before every write, which closes that hole for *this app*. But if
-- RLS on the `polls`/`users` tables is permissive (or disabled), anyone
-- with any valid session — or an anonymous key alone, if RLS is off — can
-- still read/write your tables directly via the Supabase REST/JS client,
-- completely outside your Next.js app. RLS is the real boundary; the app
-- code above is defense-in-depth on top of it, not a replacement for it.
--
-- Adjust table/column names below to match your actual schema before
-- running this. Review it in the Supabase SQL Editor rather than blindly
-- executing against production.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;

-- Every signed-in user may read their own row (needed so the app can look
-- up `role` for the current user).
create policy "users can read their own row"
on public.users
for select
to authenticated
using (auth.uid() = id);

-- Intentionally no INSERT/UPDATE/DELETE policy for regular users here.
--
-- ⚠️ CRITICAL: do NOT add a policy that lets a user UPDATE their own `role`
-- column. If `role` is user-writable, any signed-in visitor can run
-- `supabase.from('users').update({ role: 'admin' }).eq('id', myId)` and
-- promote themselves to admin. Grant the admin role only via the Supabase
-- dashboard's table editor, a service-role script, or a Postgres function
-- that only staff can invoke — never via a policy visible to `authenticated`.

-- ---------------------------------------------------------------------------
-- polls
-- ---------------------------------------------------------------------------
alter table public.polls enable row level security;

-- Public voting page: anyone (including signed-out visitors) can read
-- active polls. Adjust the `status` value/column to match your schema, or
-- drop the `where` clause if all polls should always be publicly readable.
create policy "anyone can read active polls"
on public.polls
for select
to anon, authenticated
using (status = 'active');

-- Admins can do everything, including reading non-active/draft polls.
create policy "admins have full access to polls"
on public.polls
for all
to authenticated
using (
  exists (
    select 1 from public.users
    where users.id = auth.uid() and users.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.users
    where users.id = auth.uid() and users.role = 'admin'
  )
);
