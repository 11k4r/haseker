# Poll admin — refactor notes

This rebuilds the 6 uploaded files into a proper Next.js project structure. The
short version: the biggest problem was that **"admin" access was decided
entirely in the browser**, which is not actually access control. Everything
else below is real too, but that one gets its own section.

## 1. The critical bug: client-side-only admin gating

```tsx
// original code
const { data: userData } = await supabase.from('users').select('role')...
if (userData?.role !== 'admin') { alert('...'); router.push('/'); }
else { fetchData(); }
```

This runs in the browser, after the page has already loaded. Anyone can:

- View the page source / React DevTools before the redirect fires (brief
  flash of admin data), or
- Just open the browser console and run
  `supabase.from('polls').insert([...])` directly with their own anon-key
  session — the React component's role check never even runs.

The only thing that actually stops that is **Row Level Security (RLS)** on
the `polls`/`users` tables in Postgres. If RLS is off or permissive, the
`role !== 'admin'` check in the old code was purely cosmetic.

**What changed:**
- `app/admin/layout.tsx` now checks auth + role **server-side**, before any
  admin HTML is sent. A non-admin never sees the dashboard, not even for a
  frame.
- Every mutation (`app/admin/actions.ts`) is a **Server Action that
  independently re-checks the admin role**. This matters because Server
  Actions are their own HTTP endpoints — `layout.tsx` guards *pages*, not
  actions, so each action re-checks rather than trusting that the UI it was
  called from was itself protected.
- `supabase/migrations/0001_polls_and_users_rls.sql` adds the RLS policies
  that are the actual enforcement layer underneath all of this. **Run this
  (adjusted to your real schema) — the app-level checks are defense in
  depth, not a substitute for it.**

## 2. Other bugs fixed

| # | Bug | Fix |
|---|-----|-----|
| 1 | `layout.tsx` set `--font-geist-sans`/`--font-geist-mono` in CSS but never loaded the fonts — `font-sans` silently fell back to the browser default | Added `next/font/google` `Geist`/`Geist_Mono` imports and applied the variable classes to `<body>` |
| 2 | `globals.css` had a `prefers-color-scheme: dark` block that was always overridden by a hardcoded `body { background-color: #0a0f1c }` — dead, conflicting CSS | Removed the light/dark scaffolding; the app is intentionally single-theme, `body` now references the CSS vars once |
| 3 | `supabase.ts` used `process.env.X!` — a missing env var became a cryptic runtime crash | `lib/env.ts` validates and throws a clear, actionable error |
| 4 | No error handling in `fetchData`, `handleCreateOrUpdate`, `handleDelete` beyond a blocking `alert()` | Server Actions return `{ error }`; a toast notification system (`components/toast.tsx`) shows it without blocking the UI |
| 5 | Table row images used `alt=""` (decorative) even though the image *is* the poll option's content, and had no broken-image fallback | `alt={poll.option_a}` / `alt={poll.option_b}`, plus `onError` to hide a broken image instead of showing a broken-image icon |
| 6 | `option_a`/`option_b` could be saved as whitespace-only strings (HTML `required` doesn't catch that) | Server Actions trim and validate before writing to the DB |
| 7 | Google login didn't handle a failed `signInWithOAuth` call, had no loading state, and always redirected to `/` regardless of where the user came from | `login-form.tsx` shows a loading/error state and preserves `?next=` |
| 8 | No OAuth callback route — with cookie-based SSR auth this is required to actually turn Google's redirect into a session | Added `app/auth/callback/route.ts` |
| 9 | Visiting `/login` while already signed in just showed the login screen again | `app/login/page.tsx` checks server-side and redirects home if already authenticated |
| 10 | Tag suggestion matching was case-sensitive | Now case-insensitive |
| 11 | `polls`/`knownTags` typed as `any[]` | `lib/types/poll.ts` — typed `Poll`/`PollInput` throughout |

## 3. New file structure

```
proxy.ts                        # Next.js 16's "proxy" (formerly middleware.ts) — refreshes the auth session
lib/
  env.ts                        # validated env vars
  types/poll.ts                 # Poll / PollInput types
  supabase/
    client.ts                   # browser client
    server.ts                   # server client (Server Components/Actions/Route Handlers)
    proxy.ts                    # session-refresh helper used by root proxy.ts
app/
  layout.tsx
  globals.css
  login/
    page.tsx                    # server: redirects if already signed in
    login-form.tsx              # client: the actual Google button
  auth/callback/route.ts        # exchanges the OAuth code for a session
  admin/
    layout.tsx                  # ← the real access-control boundary
    page.tsx                    # server: fetches polls, passes to the client dashboard
    actions.ts                  # 'use server' — createPoll / updatePoll / deletePoll / signOutAction
    admin-dashboard.tsx          # client: orchestrates form + table + toasts
    components/
      poll-form.tsx
      polls-table.tsx
      tag-input.tsx
      toast.tsx
supabase/migrations/0001_polls_and_users_rls.sql
.env.example
```

I moved `lib/` out of `app/` (the original imported `../lib/supabase`,
implying `app/lib/supabase.ts`) to the project root, and everything now
imports it via the `@/` alias instead of relative paths — this matches
Supabase's own current Next.js docs and survives files being moved around.
If your `tsconfig.json` doesn't already have `"paths": { "@/*": ["./*"] }`,
add it (this is the default in every `create-next-app` scaffold).

## 4. Setup

```bash
npm install @supabase/supabase-js @supabase/ssr
```

1. Copy `.env.example` to `.env.local` and fill in your project URL/key.
2. In the Supabase dashboard → **Authentication → URL Configuration**, add
   your OAuth callback as a redirect URL:
   `http://localhost:3000/auth/callback` (dev) and
   `https://your-domain.com/auth/callback` (prod).
3. Review and run `supabase/migrations/0001_polls_and_users_rls.sql` in the
   SQL Editor, adjusted to your actual schema — **do not skip this**, see
   §1 above. In particular, double-check there's no policy letting a user
   update their own `role` column (self-promotion to admin).
4. `npm run dev`.

## 5. A note on Next.js 16

Next.js 16 renamed `middleware.ts` → `proxy.ts` (same mechanism, same
`matcher` config, just a clearer name — see
[nextjs.org/docs/app/getting-started/proxy](https://nextjs.org/docs/app/getting-started/proxy)).
Everything here was written and type-checked against Next.js 16.3.4. If
you're on Next.js ≤15, rename `proxy.ts` → `middleware.ts` and the exported
`proxy` function → `middleware`; the body is identical.

## 6. Known limitations / suggested follow-ups

- **Images**: option images render as plain `<img>`, not `next/image`.
  Since admins can paste a URL from *any* domain, `next/image` would need
  every possible domain whitelisted in `next.config`, which isn't
  practical here. If you want optimization, consider uploading images to
  Supabase Storage and using its CDN URLs, or a signed-upload flow.
- **Pagination**: `app/admin/page.tsx` fetches all polls with no limit. Fine
  for hundreds of rows; add `.range()`/pagination if this grows large.
- **Delete confirmation** still uses the native `confirm()` dialog rather
  than a styled modal — functional, but you may want to replace it for a
  more polished feel.
- **Accessibility**: `viewport.userScalable = false` (kept from the
  original, with its original comment) disables pinch-to-zoom, which some
  low-vision users rely on. Worth reconsidering.
