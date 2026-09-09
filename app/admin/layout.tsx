import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * This is the security boundary for every page under /admin.
 * It runs on the server before any markup is streamed to the client, so —
 * unlike the original client-side check — there's no flash of the admin
 * dashboard for a logged-out or non-admin visitor, and someone with
 * JavaScript disabled (or DevTools open) can't just skip past it.
 *
 * Note: this protects *pages*. It does NOT protect Server Actions — those
 * are their own endpoints and each one re-checks admin status itself (see
 * app/admin/actions.ts). Never assume a layout guard is enough for actions.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user) {
    redirect('/login?next=/admin');
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.sub)
    .single();

  if (error || profile?.role !== 'admin') {
    redirect('/');
  }

  return <>{children}</>;
}
