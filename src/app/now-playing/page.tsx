async function getData() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/now.json`, { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json();
}
export default async function NowPlaying() {
  const title = process.env.NEXT_PUBLIC_DASHBOARD_TITLE ?? "Wakama Oracle";
  const data = await getData();
  const t = data?.totals ?? { files: 0, cids: 0, onchainTx: 0, lastTs: "—" };
  const items: any[] = data?.items ?? [];
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold mb-2">{title} · Now Playing</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border p-4"><div className="text-sm text-gray-500">Fichiers</div><div className="text-2xl">{t.files}</div></div>
        <div className="rounded-xl border p-4"><div className="text-sm text-gray-500">CIDs</div><div className="text-2xl">{t.cids}</div></div>
        <div className="rounded-xl border p-4"><div className="text-sm text-gray-500">Tx on-chain</div><div className="text-2xl">{t.onchainTx}</div></div>
        <div className="rounded-xl border p-4"><div className="text-sm text-gray-500">Dernier batch</div><div className="text-2xl">{t.lastTs}</div></div>
      </div>
      <div className="mt-8 rounded-xl border">
        <div className="p-4 border-b font-medium">Derniers items</div>
        <ul className="p-4 text-sm space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono">{it.file}</span>
              <span className="text-gray-500">CID: {String(it.cid).slice(0,8)}…</span>
              <span className="text-gray-500">Tx: {String(it.tx).slice(0,8)}…</span>
              <span className="text-gray-500">{it.ts}</span>
            </li>
          ))}
          {items.length === 0 && <li className="text-gray-500">Aucun item.</li>}
        </ul>
      </div>
    </main>
  );
}
