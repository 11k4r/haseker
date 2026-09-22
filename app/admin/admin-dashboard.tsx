'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createPoll, deletePoll, signOutAction, updatePoll } from './actions';
import { PollForm } from './components/poll-form';
import { PollsTable } from './components/polls-table';
import { ToastProvider, useToast } from './components/toast';
import { supabase } from '@/lib/supabase/client';
import { EMPTY_POLL_INPUT, pollToInput, type Poll, type PollInput } from '@/lib/types/poll';

interface AdminDashboardProps {
  initialPolls: Poll[];
  fetchError: string | null;
}

export function AdminDashboard(props: AdminDashboardProps) {
  return (
    <ToastProvider>
      <AdminDashboardInner {...props} />
    </ToastProvider>
  );
}

function AdminDashboardInner({ initialPolls, fetchError }: AdminDashboardProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValue, setFormValue] = useState<PollInput>(EMPTY_POLL_INPUT);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // `initialPolls` is refreshed automatically by Next.js after this admin's
  // own Server Actions (see revalidatePath('/admin') in actions.ts) — that
  // covers changes made from this tab. It does NOT cover a vote cast by
  // someone else on the public page, which never touches this route at
  // all, so `polls` is real local state kept in sync from the prop and
  // overlaid with a realtime subscription below for everything else.
  const [polls, setPolls] = useState<Poll[]>(initialPolls);
  useEffect(() => setPolls(initialPolls), [initialPolls]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-polls-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Poll;
          setPolls((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        } else if (payload.eventType === 'INSERT') {
          const inserted = payload.new as Poll;
          setPolls((prev) => (prev.some((p) => p.id === inserted.id) ? prev : [inserted, ...prev]));
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as Poll).id;
          setPolls((prev) => prev.filter((p) => p.id !== deletedId));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const knownTags = useMemo(() => {
    const set = new Set<string>();
    polls.forEach((p) => p.tags?.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [polls]);

  useEffect(() => {
    if (fetchError) showToast('error', `שגיאה בטעינת סקרים: ${fetchError}`);
  }, [fetchError, showToast]);

  const resetForm = () => {
    setEditingId(null);
    setFormValue(EMPTY_POLL_INPUT);
  };

  const handleEdit = (poll: Poll) => {
    setEditingId(poll.id);
    setFormValue(pollToInput(poll));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = editingId ? await updatePoll(editingId, formValue) : await createPoll(formValue);

    if (result.error) {
      showToast('error', `שגיאה בשמירת הסקר: ${result.error}`);
    } else {
      showToast('success', editingId ? 'הסקר עודכן בהצלחה' : 'הסקר נוסף בהצלחה');
      resetForm();
      router.refresh();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק סקר זה?')) return;

    setDeletingId(id);
    const result = await deletePoll(id);

    if (result.error) {
      showToast('error', `שגיאה במחיקת הסקר: ${result.error}`);
    } else {
      showToast('success', 'הסקר נמחק');
      router.refresh();
    }
    setDeletingId(null);
  };

  return (
    <main dir="rtl" className="flex min-h-[100dvh] flex-col items-center bg-[#0a0f1c] p-4 text-white font-sans overflow-x-hidden">
      <div className="w-full max-w-4xl flex justify-between items-center mb-8 bg-white/5 p-4 rounded-2xl border border-white/10 mt-4">
        <h1 className="text-xl font-black text-cyan-400">ניהול סקרים מתקדם</h1>
        <div className="flex gap-4 items-center">
          <Link href="/" className="text-sm font-bold text-gray-400 hover:text-white">
            למסך הראשי
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="text-sm font-bold text-rose-400 hover:text-rose-300">
              התנתק
            </button>
          </form>
        </div>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] shadow-2xl h-fit">
          <h2 className="text-2xl font-black mb-6">{editingId ? 'ערוך סקר' : 'צור סקר חדש'}</h2>
          <PollForm
            value={formValue}
            onChange={setFormValue}
            knownTags={knownTags}
            editing={!!editingId}
            submitting={submitting}
            onSubmit={handleSubmit}
            onCancel={resetForm}
          />
        </div>

        <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] shadow-2xl overflow-x-auto">
          <h2 className="text-2xl font-black mb-6">סקרים קיימים</h2>
          <PollsTable polls={polls} onEdit={handleEdit} onDelete={handleDelete} deletingId={deletingId} />
        </div>
      </div>
    </main>
  );
}