export default function NowPlaying() {
  const title = process.env.NEXT_PUBLIC_DASHBOARD_TITLE ?? "Wakama Oracle";
  const rpc = process.env.NEXT_PUBLIC_RPC ?? "n/a";
  const program = process.env.NEXT_PUBLIC_PROGRAM_ID ?? "n/a";
  const gw = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "n/a";

  // Mocks J1
  const totals = { files: 10, cids: 10, onchainTx: 10, lastTs: "—" };

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold mb-2">{title} · Now Playing</h1>
      <p className="text-sm text-gray-500 mb-6">RPC: {rpc} · Program: {program} · IPFS: {gw}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border p-4"><div className="text-sm text-gray-500">Fichiers</div><div className="text-2xl">{totals.files}</div></div>
        <div className="rounded-xl border p-4"><div className="text-sm text-gray-500">CIDs</div><div className="text-2xl">{totals.cids}</div></div>
        <div className="rounded-xl border p-4"><div className="text-sm text-gray-500">Tx on-chain</div><div className="text-2xl">{totals.onchainTx}</div></div>
        <div className="rounded-xl border p-4"><div className="text-sm text-gray-500">Dernier batch</div><div className="text-2xl">{totals.lastTs}</div></div>
      </div>

      <div className="mt-8 rounded-xl border">
        <div className="p-4 border-b font-medium">Derniers items (mock)</div>
        <div className="p-4 text-sm text-gray-500">À relier au publisher/ingest plus tard.</div>
      </div>
    </main>
  );
}
