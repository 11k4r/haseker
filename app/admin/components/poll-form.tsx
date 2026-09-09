'use client';

import type { PollInput, PollType } from '@/lib/types/poll';
import { TagInput } from './tag-input';

interface PollFormProps {
  value: PollInput;
  onChange: (value: PollInput) => void;
  knownTags: string[];
  editing: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function PollForm({ value, onChange, knownTags, editing, submitting, onSubmit, onCancel }: PollFormProps) {
  const set = <K extends keyof PollInput>(key: K, v: PollInput[K]) => onChange({ ...value, [key]: v });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <label htmlFor="poll-type" className="block text-xs font-bold text-gray-400 mb-1">
          סוג סקר
        </label>
        <select
          id="poll-type"
          value={value.poll_type}
          onChange={(e) => set('poll_type', e.target.value as PollType)}
          className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 appearance-none"
        >
          <option value="standard">רגיל</option>
          <option value="daily">סקר יומי</option>
          <option value="blitz">בליץ (מוגבל בזמן)</option>
        </select>
      </div>

      <div>
        <label htmlFor="poll-title" className="block text-xs font-bold text-gray-400 mb-1">
          כותרת / שאלה (לא חובה)
        </label>
        <input
          id="poll-title"
          type="text"
          placeholder="לדוגמה: חומוס - פול או גרגירים?"
          value={value.title}
          onChange={(e) => set('title', e.target.value)}
          className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500"
        />
      </div>

      <div className="p-4 bg-cyan-900/10 border border-cyan-500/20 rounded-2xl">
        <label htmlFor="option-a" className="block text-sm font-bold text-cyan-400 mb-2">
          אפשרות א&apos; (ימין)
        </label>
        <input
          id="option-a"
          type="text"
          placeholder="טקסט"
          value={value.option_a}
          onChange={(e) => set('option_a', e.target.value)}
          className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white mb-2 focus:outline-none focus:border-cyan-500"
          required
        />
        <input
          type="url"
          placeholder="URL של תמונה"
          value={value.image_a_url}
          onChange={(e) => set('image_a_url', e.target.value)}
          aria-label="קישור לתמונה של אפשרות א׳"
          className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-cyan-500"
        />
      </div>

      <div className="p-4 bg-pink-900/10 border border-pink-500/20 rounded-2xl">
        <label htmlFor="option-b" className="block text-sm font-bold text-pink-400 mb-2">
          אפשרות ב&apos; (שמאל)
        </label>
        <input
          id="option-b"
          type="text"
          placeholder="טקסט"
          value={value.option_b}
          onChange={(e) => set('option_b', e.target.value)}
          className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white mb-2 focus:outline-none focus:border-pink-500"
          required
        />
        <input
          type="url"
          placeholder="URL של תמונה"
          value={value.image_b_url}
          onChange={(e) => set('image_b_url', e.target.value)}
          aria-label="קישור לתמונה של אפשרות ב׳"
          className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-pink-500"
        />
      </div>

      <TagInput selectedTags={value.tags} knownTags={knownTags} onChange={(tags) => set('tags', tags)} />

      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-black py-3 rounded-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100"
        >
          {submitting ? 'שומר...' : editing ? 'עדכן סקר' : 'הוסף +'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={onCancel}
            className="bg-white/10 text-white font-bold px-4 rounded-xl hover:bg-white/20"
          >
            ביטול
          </button>
        )}
      </div>
    </form>
  );
}
