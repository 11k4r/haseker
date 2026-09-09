'use client';

import { useState } from 'react';

interface TagInputProps {
  selectedTags: string[];
  knownTags: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ selectedTags, knownTags, onChange }: TagInputProps) {
  const [tagInput, setTagInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addTag = (tag: string) => {
    const clean = tag.trim();
    if (clean && !selectedTags.includes(clean)) onChange([...selectedTags, clean]);
    setTagInput('');
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => onChange(selectedTags.filter((t) => t !== tag));

  const suggestions = knownTags.filter(
    (t) => t.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.includes(t)
  );

  return (
    <div className="relative">
      <label htmlFor="tag-input" className="block text-sm font-bold text-gray-400 mb-1">
        תגיות
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="bg-white/10 border border-white/20 text-white px-3 py-1 text-xs font-bold rounded-full flex items-center gap-2"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`הסר תגית ${tag}`}
              className="text-rose-400 hover:text-rose-300"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        id="tag-input"
        type="text"
        placeholder="הקלד תגית ו-Enter"
        value={tagInput}
        onChange={(e) => {
          setTagInput(e.target.value);
          setShowSuggestions(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addTag(tagInput);
          }
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-white/50"
      />

      {showSuggestions && tagInput && suggestions.length > 0 && (
        <div className="absolute w-full mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
          {suggestions.map((tag) => (
            <div
              key={tag}
              onMouseDown={() => addTag(tag)}
              className="p-3 hover:bg-white/10 cursor-pointer text-sm font-bold"
            >
              {tag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
