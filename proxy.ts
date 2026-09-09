import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same mechanism, clearer
// name). If your project is still on Next.js <16, rename this file to
// `middleware.ts` and rename the exported function to `middleware` — the
// body is otherwise identical.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every route except static assets, so the Supabase session
     * cookie stays fresh everywhere the user navigates.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
