'use client';

type NowItem = {
  ts?: string;
  tx?: string;
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

export default function TxHistory({ items }: { items: NowItem[] }) {
  // on prend les 20 derniers
  const last = items.slice(0, 20).reverse();

  // si tx présent → barre haute, sinon basse
  const heights = last.map((it) => (it.tx ? 40 : 12));
  const max = Math.max(...heights, 40);

  return (
    <div className="h-40 w-full rounded-lg bg-[#0A0B1A] border border-white/5 px-2 py-3 flex items-end gap-1 overflow-x-auto">
      {heights.map((h, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div
            className={`w-3 rounded-t ${
              h > 20 ? 'bg-emerald-400/90' : 'bg-emerald-400/35'
            }`}
            style={{ height: `${(h / max) * 100}%`, minHeight: '6px' }}
          />
          <span className="text-[8px] text-white/25">
            {toReadableTime(last[i]?.ts)}
          </span>
        </div>
      ))}
    </div>
  );
}
