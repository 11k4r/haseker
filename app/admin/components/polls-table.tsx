'use client';

import type { Poll } from '@/lib/types/poll';

interface PollsTableProps {
  polls: Poll[];
  onEdit: (poll: Poll) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}

const POLL_TYPE_LABEL: Record<Poll['poll_type'], string> = {
  blitz: '⚡ בליץ',
  daily: '📅 יומי',
  standard: 'רגיל',
};

export function PollsTable({ polls, onEdit, onDelete, deletingId }: PollsTableProps) {
  if (polls.length === 0) {
    return <p className="text-gray-400 text-center py-8 font-bold">אין סקרים עדיין. צור את הסקר הראשון!</p>;
  }

  return (
    <table className="w-full text-sm text-right">
      <thead className="text-xs text-gray-400 uppercase bg-black/20">
        <tr>
          <th className="px-4 py-3">סוג</th>
          <th className="px-4 py-3">כותרת</th>
          <th className="px-4 py-3">אפשרות א&apos;</th>
          <th className="px-4 py-3">אפשרות ב&apos;</th>
          <th className="px-4 py-3 text-center">פעולות</th>
        </tr>
      </thead>
      <tbody>
        {polls.map((poll) => (
          <tr key={poll.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
            <td className="px-4 py-3 font-bold text-gray-300">{POLL_TYPE_LABEL[poll.poll_type] ?? poll.poll_type}</td>
            <td className="px-4 py-3 text-gray-200 font-medium">{poll.title || '-'}</td>
            <td className="px-4 py-3 text-cyan-300 font-bold">
              <div className="flex items-center gap-2">
                {poll.image_a_url && (
                  <img
                    src={poll.image_a_url}
                    alt={poll.option_a}
                    className="w-6 h-6 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                {poll.option_a}
              </div>
            </td>
            <td className="px-4 py-3 text-pink-300 font-bold">
              <div className="flex items-center gap-2">
                {poll.image_b_url && (
                  <img
                    src={poll.image_b_url}
                    alt={poll.option_b}
                    className="w-6 h-6 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                {poll.option_b}
              </div>
            </td>
            <td className="px-4 py-3">
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => onEdit(poll)}
                  className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 px-3 py-1 rounded-lg font-bold"
                >
                  ערוך
                </button>
                <button
                  onClick={() => onDelete(poll.id)}
                  disabled={deletingId === poll.id}
                  className="bg-rose-500/20 text-rose-400 hover:bg-rose-500/40 px-3 py-1 rounded-lg font-bold disabled:opacity-50"
                >
                  {deletingId === poll.id ? 'מוחק...' : 'מחק'}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
