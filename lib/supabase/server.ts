import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Must be created fresh on every request (never cached in a module-level
 * variable) since it's bound to that request's cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // `setAll` was called from a Server Component, which can't write
          // cookies. This is fine as long as proxy.ts is refreshing the
          // session on every request (see lib/supabase/proxy.ts).
        }
      },
    },
  });
}
