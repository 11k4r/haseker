import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Google redirects here after the user approves sign-in. This exchanges the
 * one-time `code` for a real Supabase session and writes it to cookies —
 * without this route, cookie-based SSR auth (used by proxy.ts and every
 * Server Component/Action in app/admin) never gets a session to read.
 *
 * Add this URL to Supabase Dashboard → Authentication → URL Configuration
 * → Redirect URLs, e.g. https://your-domain.com/auth/callback
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  let next = searchParams.get('next') ?? '/';
  if (!next.startsWith('/')) {
    // Guard against an open redirect via a crafted `next` param.
    next = '/';
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // Behind a load balancer, `origin` may be an internal address —
        // x-forwarded-host has the address the user actually requested.
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
