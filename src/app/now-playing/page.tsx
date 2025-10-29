export default function NowPlaying() {
  const cards = [
    { label: "Batches publiés (24h)", value: "12" },
    { label: "Points on-chain (cumul)", value: "150 234" },
    { label: "Latence médiane (s)", value: "4.2" },
  ];
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-semibold">Now Playing</h1>
      <p className="text-sm text-gray-500 mt-1">Aperçu temps réel (mock)</p>
      <div className="grid gap-4 mt-6 sm:grid-cols-3">
        {cards.map(c => (
          <div key={c.label} className="rounded-xl border p-4">
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className="mt-2 text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 text-sm text-gray-500">
        TODO: brancher Firestore/IPFS + events Anchor (DataBatch).
      </div>
    </main>
  );
}
