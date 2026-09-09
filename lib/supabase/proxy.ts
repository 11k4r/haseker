import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

/**
 * Refreshes the Supabase Auth session cookie on every request and does a
 * cheap, unauthenticated-only redirect for /admin routes.
 *
 * This is a *fast, optimistic* check — it only confirms a session exists.
 * It intentionally does NOT check the admin `role`, because that requires a
 * database round trip and Proxy is not the right place to pay that cost on
 * every request (see https://nextjs.org/docs/app/getting-started/proxy).
 * The actual role check — the one that really matters for security — lives
 * in app/admin/layout.tsx (for pages) and inside every Server Action in
 * app/admin/actions.ts (for mutations, since actions have their own
 * endpoint and are NOT protected by layout.tsx alone).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims(). A simple
  // mistake here can make it very hard to debug users being randomly
  // logged out. getClaims() (not getSession()) is what actually refreshes
  // and verifies the token.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');

  if (isAdminRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // IMPORTANT: return supabaseResponse as-is (or copy its cookies onto any
  // replacement response) or the browser and server sessions can fall out
  // of sync.
  return supabaseResponse;
}
