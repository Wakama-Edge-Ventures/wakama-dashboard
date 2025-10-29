'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  label?: string;
  auto?: boolean;          // si true, auto-refresh périodique
  intervalMs?: number;     // période en ms (défaut 15000)
};

export default function RefreshButton({ label = 'Refresh', auto = false, intervalMs = 15000 }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);

  const doRefresh = useCallback(() => {
    if (busy) return;
    setBusy(true);
    // rafraîchit les Server Components (revalide les fetch côté serveur)
    router.refresh();
    // micro delai visuel
    setTimeout(() => setBusy(false), 350);
  }, [busy, router]);

  useEffect(() => {
    if (!auto) return;
    // évite les doublons
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(doRefresh, Math.max(3000, intervalMs));
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [auto, intervalMs, doRefresh]);

  return (
    <button
      type="button"
      onClick={doRefresh}
      className="rounded-xl border border-white/15 px-3 py-1.5 text-sm hover:bg-[#14F195]/15 transition-colors disabled:opacity-60"
      disabled={busy}
      aria-busy={busy}
      title={auto ? `Auto-refresh ${Math.floor((intervalMs||0)/1000)}s ON` : 'Manual refresh'}
    >
      {busy ? 'Refreshing…' : label}
    </button>
  );
}
