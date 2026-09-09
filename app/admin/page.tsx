import { createClient } from '@/lib/supabase/server';
import { AdminDashboard } from './admin-dashboard';
import type { Poll } from '@/lib/types/poll';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('polls')
    .select('*')
    .order('created_at', { ascending: false });

  const polls: Poll[] = (data ?? []).map((p) => ({ ...p, tags: p.tags ?? [] }));

  return <AdminDashboard initialPolls={polls} fetchError={error?.message ?? null} />;
}