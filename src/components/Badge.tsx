'use client';

import React from 'react';

type Tone = 'ok' | 'warn' | 'neutral';

export default function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  title?: string;
}) {
  const map: Record<Tone, string> = {
    ok: 'bg-emerald-400/20 text-emerald-200 border-emerald-400/30',
    warn: 'bg-yellow-400/20 text-yellow-200 border-yellow-400/30',
    neutral: 'bg-white/10 text-white/80 border-white/20',
  };
  const cls = map[tone] || map.neutral;
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ${cls}`}
    >
      {children}
    </span>
  );
}
