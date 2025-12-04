// src/app/rwa/page.tsx

import Link from "next/link";

type Batch = {
  id: string;
  cid: string;
  teamId: string;
  txSignature: string;
  rwaId: string;
  deviceId: string;
  pointsCount: number;
  sourceType: string;
  timestamp: {
    seconds: number;
    nanoseconds: number;
  };
};

type Rwa = {
  id: string;
  name: string;
  teamId: string;
  region: string;
  status: string;
  network: string;
  mintAddress: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
};

type Team = {
  id: string;
  name: string;
  type: string;
  external: boolean;
};

async function fetchRwaData() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const res = await fetch(`${base}/api/rwa-demo`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error("Failed to load RWA data");
  }

  return (await res.json()) as {
    batches: Batch[];
    rwas: Rwa[];
    teams: Team[];
  };
}

function formatDate(ts?: { seconds: number; nanoseconds: number }) {
  if (!ts) return "—";
  const d = new Date(ts.seconds * 1000);
  return d.toISOString().split("T")[0];
}

export default async function RwaPage() {
  const { batches, rwas, teams } = await fetchRwaData();

  return (
    <main className="relative min-h-screen bg-[#020617] px-4 py-8 text-white">
      {/* Solana-style background, lighter than the landing page */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#020617]" />
        <div className="absolute -top-40 -left-24 h-72 w-[32rem] rotate-12 rounded-full bg-gradient-to-tr from-[#9945FF] via-[#39D0D8] to-[#14F195] blur-3xl opacity-25" />
        <div className="absolute bottom-[-8rem] right-[-10rem] h-64 w-[32rem] -rotate-6 rounded-full bg-gradient-to-tr from-[#14F195] via-[#39D0D8] to-[#9945FF] blur-3xl opacity-15" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/70">
              RWA Monitoring · Devnet
            </div>
            <h1 className="mt-3 bg-gradient-to-r from-[#14F195] via-[#39D0D8] to-[#9945FF] bg-clip-text text-2xl font-semibold text-transparent sm:text-3xl">
              On-chain RWA overview powered by Wakama Oracle
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-white/65 sm:text-sm">
              Synthetic view of RWA assets, teams and latest IoT batches
              published on Solana Devnet, with direct IPFS and Explorer links.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/"
              className="rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-xs text-white/80 hover:border-[#14F195]/60 hover:text-[#14F195]"
            >
              ← Back to landing
            </Link>
            <Link
              href="/now-playing"
              className="rounded-full bg-gradient-to-r from-[#14F195] to-[#39D0D8] px-4 py-1.5 text-xs font-semibold text-black hover:opacity-95"
            >
              Live oracle stream
            </Link>
          </div>
        </header>

        {/* High-level summary */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm">
            <div className="text-xs text-white/60">RWA assets</div>
            <div className="mt-1 text-2xl font-semibold">{rwas.length}</div>
            <div className="mt-2 text-[11px] text-white/55">
              Assets tracked in Firestore and on Solana Devnet.
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm">
            <div className="text-xs text-white/60">Teams</div>
            <div className="mt-1 text-2xl font-semibold">{teams.length}</div>
            <div className="mt-2 text-[11px] text-white/55">
              Core team + external partners (universities, co-ops, etc.).
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm">
            <div className="text-xs text-white/60">Recorded batches</div>
            <div className="mt-1 text-2xl font-semibold">{batches.length}</div>
            <div className="mt-2 text-[11px] text-white/55">
              Number of IoT lots currently indexed.
            </div>
          </div>
        </section>

        {/* RWA table */}
        <section className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white/90">
              RWA assets overview
            </h2>
          </div>

          <div className="overflow-x-auto text-xs sm:text-sm">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/60">
                  <th className="px-2 py-2 text-left">RWA</th>
                  <th className="px-2 py-2 text-left">Team</th>
                  <th className="px-2 py-2 text-left">Region</th>
                  <th className="px-2 py-2 text-left">Network</th>
                  <th className="px-2 py-2 text-left">Mint</th>
                  <th className="px-2 py-2 text-left">Last batch</th>
                  <th className="px-2 py-2 text-left">Points</th>
                  <th className="px-2 py-2 text-left">Links</th>
                </tr>
              </thead>
              <tbody>
                {rwas.map((rwa) => {
                  const team = teams.find((t) => t.id === rwa.teamId);
                  const related = batches.filter((b) => b.rwaId === rwa.id);

                  const last = related
                    .slice()
                    .sort(
                      (a, b) =>
                        (a.timestamp?.seconds || 0) -
                        (b.timestamp?.seconds || 0),
                    )
                    .at(-1);

                  return (
                    <tr
                      key={rwa.id}
                      className="border-b border-white/10 last:border-0"
                    >
                      <td className="px-2 py-2 font-medium">{rwa.name}</td>
                      <td className="px-2 py-2">{team?.name ?? rwa.teamId}</td>
                      <td className="px-2 py-2">{rwa.region}</td>
                      <td className="px-2 py-2 uppercase">{rwa.network}</td>
                      <td className="px-2 py-2">
                        <span className="font-mono text-[11px]">
                          {rwa.mintAddress}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {last ? formatDate(last.timestamp) : "—"}
                      </td>
                      <td className="px-2 py-2">
                        {last ? last.pointsCount : 0}
                      </td>
                      <td className="px-2 py-2">
                        {last && (
                          <div className="flex flex-wrap gap-1 text-[11px]">
                            <a
                              href={`https://ipfs.io/ipfs/${last.cid}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-white/20 px-2 py-0.5 hover:border-[#14F195]/70 hover:text-[#14F195]"
                            >
                              IPFS
                            </a>
                            <a
                              href={`https://explorer.solana.com/tx/${last.txSignature}?cluster=devnet`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-white/20 px-2 py-0.5 hover:border-[#39D0D8]/70 hover:text-[#39D0D8]"
                            >
                              Solana tx
                            </a>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
