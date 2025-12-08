// src/app/rwa/page.tsx

import Link from "next/link";
import fs from "fs/promises";
import path from "path";

type TimestampLike = {
  seconds?: number;
  nanoseconds?: number;
};

type Batch = {
  id: string;
  cid: string;
  teamId: string;
  txSignature: string;
  rwaId: string;
  deviceId: string;
  pointsCount: number;
  sourceType: string;
  timestamp: TimestampLike;
};

type Rwa = {
  id: string;
  name: string;
  teamId: string;
  region: string;
  status: string;
  network: string;
  mintAddress: string;
  createdAt: TimestampLike;
};

type Team = {
  id: string;
  name: string;
  type: string;
  external: boolean;
};

// --- M2 proof types (static assets in public/proofs/m2) ---
type M2Summary = {
  m2_total_points?: number;
  m2_wakama_points?: number;
  m2_external_points?: number;
  m2_external_ratio?: number; // 0..1
  m2_external_percent?: number; // 0..100
};

type M2TeamProof = {
  team: string;
  team_id?: string;
  wallet?: string;
  points?: number; // allow legacy shape
  points_m2?: number;
  active_days?: number;
  days?: string[];
  txs?: number;
  txs_m2?: number;
  tx_list?: string[];
};

type M2Proof = {
  m2_cutoff?: string;
  m2_adoption?: M2TeamProof[]; // if you kept this shape
  teams?: M2TeamProof[]; // preferred normalized shape
};

async function fetchRwaData(): Promise<{
  batches: Batch[];
  rwas: Rwa[];
  teams: Team[];
}> {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const url = base ? `${base}/api/rwa-demo` : "/api/rwa-demo";

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error("Failed to load RWA data");
  }

  return (await res.json()) as {
    batches: Batch[];
    rwas: Rwa[];
    teams: Team[];
  };
}

function formatDate(ts?: TimestampLike) {
  const sec = ts?.seconds;
  if (!sec || !Number.isFinite(sec)) return "—";
  const d = new Date(sec * 1000);
  return d.toISOString().split("T")[0];
}

// Safe local JSON reader for public assets
async function readPublicJson<T>(relPath: string): Promise<T | null> {
  try {
    const p = path.join(process.cwd(), "public", relPath);
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function num(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pct(v: any) {
  const n = num(v, 0);
  return `${n.toFixed(2)}%`;
}

function compactSig(sig?: string) {
  if (!sig) return "—";
  if (sig.length <= 18) return sig;
  return `${sig.slice(0, 8)}…${sig.slice(-6)}`;
}

function badgeClass(kind: "core" | "coop" | "university" | "partner" | "other") {
  switch (kind) {
    case "core":
      return "border-[#9945FF]/40 bg-[#9945FF]/10 text-[#c9a6ff]";
    case "coop":
      return "border-[#14F195]/40 bg-[#14F195]/10 text-[#7bffcf]";
    case "university":
      return "border-[#39D0D8]/50 bg-[#39D0D8]/10 text-[#8ef7ff]";
    case "partner":
      return "border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#ffd08a]";
    default:
      return "border-white/20 bg-white/5 text-white/70";
  }
}

function inferTeamBadge(teamName: string) {
  const t = teamName.toLowerCase();
  if (t.includes("wakama")) return badgeClass("core");
  if (t.includes("coop") || t.includes("capn") || t.includes("scak")) return badgeClass("coop");
  if (t.includes("university") || t.includes("techlab") || t.includes("ujlog") || t.includes("gede"))
    return badgeClass("university");
  if (t.includes("partner") || t.includes("makm2")) return badgeClass("partner");
  return badgeClass("other");
}

export default async function RwaPage() {
  const { batches, rwas, teams } = await fetchRwaData();

  // Load M2 proofs if present
  const m2Summary = await readPublicJson<M2Summary>("proofs/m2/m2-summary.json");
  // support either m2-proof.json or m2-adoption.json
  const m2Proof =
    (await readPublicJson<M2Proof>("proofs/m2/m2-proof.json")) ||
    (await readPublicJson<M2Proof>("proofs/m2/m2-adoption.json"));

  const proofTeamsRaw =
    m2Proof?.teams?.length
      ? m2Proof.teams
      : m2Proof?.m2_adoption?.length
      ? m2Proof.m2_adoption
      : [];

  const proofTeams = proofTeamsRaw
    .map((t) => ({
      team: t.team,
      wallet: t.wallet,
      points_m2: num(t.points_m2 ?? t.points, 0),
      active_days: num(t.active_days, 0),
      txs_m2: num(t.txs_m2 ?? t.txs, 0),
      tx_list: Array.isArray(t.tx_list) ? t.tx_list : [],
      days: Array.isArray(t.days) ? t.days : [],
    }))
    .sort((a, b) => b.points_m2 - a.points_m2);

  const m2Total = num(m2Summary?.m2_total_points, 0);
  const m2Ext = num(m2Summary?.m2_external_points, 0);
  const m2ExtPercent =
    m2Summary?.m2_external_percent != null
      ? num(m2Summary.m2_external_percent, 0)
      : m2Total > 0
      ? (m2Ext * 100) / m2Total
      : 0;

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

        {/* ✅ M2 Proof section (beautiful, non-invasive) */}
        <section className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                Milestone 2 Proof
              </span>
              <span className="inline-flex items-center rounded-full border border-[#39D0D8]/30 bg-[#39D0D8]/10 px-2 py-0.5 text-[10px] text-[#8ef7ff]">
                Increment + Adoption
              </span>
            </div>
            <div className="text-[11px] text-white/50">
              Cutoff (end of M1):{" "}
              <span className="font-mono text-white/70">
                {m2Proof?.m2_cutoff ?? "—"}
              </span>
            </div>
          </div>

          {!m2Summary ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-white/70">Proof assets not found</div>
              <div className="mt-1 text-[11px] text-white/50">
                Add files in{" "}
                <span className="font-mono">public/proofs/m2/</span>{" "}
                (m2-summary.json + m2-proof.json) to enable this panel.
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="text-[11px] text-white/55">M2 new points</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {m2Total.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[10px] text-white/45">
                    Target: +200,000
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="text-[11px] text-white/55">
                    M2 external points
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {m2Ext.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[10px] text-white/45">
                    Target: ≥70% of M2 increment
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="text-[11px] text-white/55">
                    External ratio (M2)
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {m2ExtPercent.toFixed(2)}%
                  </div>
                  <div className="mt-1 text-[10px] text-white/45">
                    Computed from M2 increment
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/60">
                      <th className="px-2 py-2 text-left">Team</th>
                      <th className="px-2 py-2 text-left">Badge</th>
                      <th className="px-2 py-2 text-left">M2 points</th>
                      <th className="px-2 py-2 text-left">Active days</th>
                      <th className="px-2 py-2 text-left">M2 txs</th>
                      <th className="px-2 py-2 text-left">Proof links</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proofTeams.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-2 py-3 text-[11px] text-white/45"
                        >
                          No team-level M2 proof loaded.
                        </td>
                      </tr>
                    ) : (
                      proofTeams.map((t) => {
                        const badge = inferTeamBadge(t.team);
                        const topTx = t.tx_list?.[0];

                        return (
                          <tr
                            key={t.team}
                            className="border-b border-white/10 last:border-0"
                          >
                            <td className="px-2 py-2 font-medium">
                              {t.team}
                            </td>
                            <td className="px-2 py-2">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${badge}`}
                              >
                                {t.team.toLowerCase().includes("wakama")
                                  ? "CORE"
                                  : t.team.toLowerCase().includes("university") ||
                                    t.team.toLowerCase().includes("techlab") ||
                                    t.team.toLowerCase().includes("gede")
                                  ? "UNIVERSITY"
                                  : t.team.toLowerCase().includes("coop") ||
                                    t.team.toLowerCase().includes("capn") ||
                                    t.team.toLowerCase().includes("scak")
                                  ? "COOP"
                                  : t.team.toLowerCase().includes("partner") ||
                                    t.team.toLowerCase().includes("makm2")
                                  ? "PARTNER"
                                  : "OTHER"}
                              </span>
                            </td>
                            <td className="px-2 py-2">
                              {t.points_m2.toLocaleString()}
                            </td>
                            <td className="px-2 py-2">
                              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                                {t.active_days}
                              </span>
                              {t.days?.length ? (
                                <span className="ml-2 text-[10px] text-white/40">
                                  {t.days.join(", ")}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-2 py-2">{t.txs_m2}</td>
                            <td className="px-2 py-2">
                              <div className="flex flex-wrap gap-1 text-[11px]">
                                {topTx ? (
                                  <a
                                    href={`https://explorer.solana.com/tx/${topTx}?cluster=devnet`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-white/20 px-2 py-0.5 hover:border-[#39D0D8]/70 hover:text-[#39D0D8]"
                                    title={topTx}
                                  >
                                    Solana tx · {compactSig(topTx)}
                                  </a>
                                ) : (
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
                                    tx list pending
                                  </span>
                                )}

                                <a
                                  href="/proofs/m2/m2-summary.json"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-white/20 px-2 py-0.5 hover:border-[#14F195]/70 hover:text-[#14F195]"
                                >
                                  m2-summary
                                </a>
                                <a
                                  href="/proofs/m2/m2-proof.json"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-white/20 px-2 py-0.5 hover:border-[#9945FF]/70 hover:text-[#c9a6ff]"
                                >
                                  m2-proof
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="text-[11px] text-white/55">
                  This panel reads static proof assets from{" "}
                  <span className="font-mono text-white/70">
                    /public/proofs/m2/
                  </span>{" "}
                  to make M2 evidence visible directly inside the dashboard.
                </div>
              </div>
            </>
          )}
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

                  const last = related.reduce<Batch | undefined>((acc, cur) => {
                    const a = acc?.timestamp?.seconds ?? 0;
                    const c = cur?.timestamp?.seconds ?? 0;
                    return c >= a ? cur : acc;
                  }, undefined);

                  const lastPoints =
                    typeof last?.pointsCount === "number"
                      ? last.pointsCount
                      : 0;

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
                      <td className="px-2 py-2">{last ? lastPoints : 0}</td>
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
