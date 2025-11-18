'use client';

type NowItem = {
  ts?: string;
  tx?: string;
  source?: string;
  team?: string;
  points?: number; // optionnel: nombre de points du batch (count)
};

function toReadableTime(ts?: string): string {
  if (!ts) return '';
  // cas 1: ISO classique
  const dIso = new Date(ts);
  if (!Number.isNaN(dIso.getTime())) {
    return dIso.toISOString().slice(11, 19); // HH:MM:SS
  }

  // cas 2: peut-être un timestamp en ms sous forme de string
  const asNum = Number(ts);
  if (!Number.isNaN(asNum)) {
    const dNum = new Date(asNum);
    if (!Number.isNaN(dNum.getTime())) {
      return dNum.toISOString().slice(11, 19);
    }
  }

  // sinon on affiche rien
  return '';
}

function shortenTx(tx?: string, head = 6, tail = 4) {
  if (!tx) return 'none';
  if (tx.length <= head + tail + 3) return tx;
  return `${tx.slice(0, head)}…${tx.slice(-tail)}`;
}

export default function TxHistory({ items }: { items: NowItem[] }) {
  
  const last = items.slice(0, 20).reverse();

  if (last.length === 0) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-lg border border-white/5 bg-[#0A0B1A] text-xs text-white/40">
        No batches yet.
      </div>
    );
  }

  // valeur "brute" = points si dispo, sinon 1 / 0.3 selon présence de tx
  const values = last.map((it) => {
    if (typeof it.points === 'number' && it.points > 0) return it.points;
    return it.tx ? 1 : 0.3;
  });

  const max = Math.max(...values, 1);

  return (
    <div className="flex h-40 w-full items-end gap-1 overflow-x-auto rounded-lg border border-white/5 bg-gradient-to-br from-[#020617] via-[#020617] to-[#020617] px-2 py-3">
      {last.map((it, i) => {
        const v = values[i];
        // hauteur normalisée: 10% mini, 90% maxi
        const hPct = 10 + (v / max) * 80;

        const timeLabel = toReadableTime(it.ts) || '—';
        const txLabel = shortenTx(it.tx);
        const teamLabel = it.team || '—';
        const sourceLabel = it.source || '—';
        const pointsLabel =
          typeof it.points === 'number' && it.points > 0 ? it.points.toString() : 'n/a';

        const hasTx = Boolean(it.tx);

        return (
          <div
            key={`${it.ts}-${i}`}
            className="flex flex-1 min-w-[10px] flex-col items-center gap-1"
          >
            {/* barre */}
            <div
              className={`relative w-3 rounded-t-md ${
                hasTx
                  ? 'bg-gradient-to-t from-[#14F195] via-[#39D0D8] to-[#9945FF]'
                  : 'bg-[#39D0D8]/30'
              } shadow-sm shadow-[#14F195]/40`}
              style={{ height: `${hPct}%`, minHeight: '6px' }}
              title={[
                `Time: ${timeLabel}`,
                `Tx: ${txLabel}`,
                `Team: ${teamLabel}`,
                `Source: ${sourceLabel}`,
                `Points: ${pointsLabel}`,
              ].join('\n')}
            >
              {hasTx && (
                <span className="pointer-events-none absolute -top-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#14F195]" />
              )}
            </div>
            {/* label de temps */}
            <span className="mt-0.5 text-[8px] text-white/30">{timeLabel}</span>
          </div>
        );
      })}
    </div>
  );
}
