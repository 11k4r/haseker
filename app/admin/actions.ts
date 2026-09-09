'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { PollInput } from '@/lib/types/poll';

type ActionResult = { error: string | null };

/**
 * Server Actions get their own HTTP endpoint and can be invoked directly
 * (not just by rendering the page they were defined near), so
 * app/admin/layout.tsx running first is NOT a guarantee here. Every
 * mutating action below calls this first — never trust the client, and
 * never trust that "the user got this far in the UI" implies they're
 * allowed to do this.
 */
async function requireAdminClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user) {
    throw new Error('הפעולה דורשת התחברות');
  }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.sub).single();

  if (profile?.role !== 'admin') {
    throw new Error('אין לך הרשאות לבצע פעולה זו');
  }

  return supabase;
}

/** Never trust client-sanitized input — re-trim/normalize on the server. */
function toDbPayload(input: PollInput) {
  const tags = Array.from(new Set(input.tags.map((t) => t.trim()).filter(Boolean)));

  return {
    poll_type: input.poll_type,
    title: input.title.trim() || null,
    option_a: input.option_a.trim(),
    image_a_url: input.image_a_url.trim() || null,
    option_b: input.option_b.trim(),
    image_b_url: input.image_b_url.trim() || null,
    tags,
  };
}

export async function createPoll(input: PollInput): Promise<ActionResult> {
  const payload = toDbPayload(input);
  if (!payload.option_a || !payload.option_b) {
    return { error: 'יש למלא את שתי האפשרויות' };
  }

  try {
    const supabase = await requireAdminClient();
    const { error } = await supabase.from('polls').insert([{ ...payload, status: 'active' }]);
    if (error) return { error: error.message };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'שגיאה לא ידועה' };
  }

  revalidatePath('/admin');
  return { error: null };
}

export async function updatePoll(id: string, input: PollInput): Promise<ActionResult> {
  const payload = toDbPayload(input);
  if (!payload.option_a || !payload.option_b) {
    return { error: 'יש למלא את שתי האפשרויות' };
  }

  try {
    const supabase = await requireAdminClient();
    const { error } = await supabase.from('polls').update(payload).eq('id', id);
    if (error) return { error: error.message };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'שגיאה לא ידועה' };
  }

  revalidatePath('/admin');
  return { error: null };
}

export async function deletePoll(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdminClient();
    const { error } = await supabase.from('polls').delete().eq('id', id);
    if (error) return { error: error.message };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'שגיאה לא ידועה' };
  }

  revalidatePath('/admin');
  return { error: null };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
