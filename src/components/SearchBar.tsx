'use client';

import { useMemo, useState } from 'react';

type Item = {
  cid: string;
  tx?: string;
  file?: string;
  source?: string;
};

export default function SearchBar({
  value,
  onChange,
  items,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  items: Item[];
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter(
        (it) =>
          it.cid.toLowerCase().includes(q) ||
          (it.tx || '').toLowerCase().includes(q) ||
          (it.file || '').toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [value, items]);

  return (
    <div className="relative w-full md:max-w-xl">
      <div className="flex items-center gap-2 rounded-xl bg-[#0F1116] border border-[#14F195]/40 px-3 py-2 shadow-sm focus-within:border-[#14F195] transition-colors">
        <span className="text-white/40 text-sm">🔍</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-white/25"
        />
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/30">
          /
        </span>
      </div>
      {focused && suggestions.length > 0 ? (
        <div className="absolute z-30 mt-1 w-full rounded-xl bg-[#0F1116] border border-white/10 shadow-lg overflow-hidden">
          {suggestions.map((sug, idx) => (
            <button
              key={idx}
              onClick={() => onChange(sug.cid)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5"
            >
              <span className="text-white">{sug.cid.slice(0, 28)}…</span>
              <span className="text-[10px] text-white/30">
                {sug.tx ? 'tx' : sug.file ? 'file' : 'cid'}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
