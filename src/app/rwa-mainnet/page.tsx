// src/app/rwa-mainnet/page.tsx
import Link from "next/link";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type AnyObj = Record<string, any>;

type BatchLike = {
  team?: string;
  teamId?: string;
  cid?: string;
  tx?: string;
  txSignature?: string;
  file?: string;
  sha256?: string;
  ts?: string;
  points?: number;
  count?: number;
  measuresCount?: number;
  status?: string;
};

function num(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeStr(v: any, fallback = "—") {
  if (typeof v === "string" && v.trim()) return v;
  return fallback;
}

function isoDay(iso?: string) {
  if (!iso || typeof iso !== "string") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function compact(s?: string, left = 8, right = 6) {
  if (!s) return "—";
  if (s.length <= left + right + 1) return s;
  return `${s.slice(0, left)}…${s.slice(-right)}`;
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

function inferTeamKind(teamIdOrName: string) {
  const t = (teamIdOrName || "").toLowerCase();
  if (t.includes("wakama")) return "core";
  if (t.includes("coop") || t.includes("capn") || t.includes("scak")) return "coop";
  if (t.includes("university") || t.includes("techlab") || t.includes("ujlog") || t.includes("gede"))
    return "university";
  if (t.includes("partner") || t.includes("makm2") || t.includes("cme")) return "partner";
  return "other";
}

function pickBatchesFromSnapshot(snap: AnyObj): BatchLike[] {
  // Tolérant: on cherche une liste de lots/batches dans plusieurs clés possibles.
  const candidates = ["items", "batches", "records", "rows", "data", "now", "list"];
  for (const k of candidates) {
    const v = snap?.[k];
    if (Array.isArray(v)) return v as BatchLike[];
  }
  // Si rien, on tente: snap itself is array
  if (Array.isArray(snap)) return snap as BatchLike[];
  return [];
}

function normalizeBatch(b: BatchLike) {
  const team = safeStr(b.team ?? b.teamId, "unknown_team");
  const cid = safeStr(b.cid, "");
  const tx = safeStr(b.tx ?? b.txSignature, "");
  const file = safeStr(b.file, "");
  const ts = safeStr(b.ts, "");
  const points = num(b.points ?? b.count ?? b.measuresCount, 0);
  return { team, cid, tx, file, ts, points };
}

async function readPublicJson<T>(relPath: string): Promise<T | null> {
  try {
    const p = path.join(process.cwd(), "public", relPath);
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type TeamAgg = {
  team: string;
  kind: string;
  batches: number;
  points: number;
  lastTs: string;
  lastCid?: string;
  lastTx?: string;
};

export default async function RwaMainnetPage() {
  // IMPORTANT: on lit le snapshot MAINNET déjà généré
  const snap = await readPublicJson<AnyObj>("now_mainnet_v2.json");

  const batchesRaw = snap ? pickBatchesFromSnapshot(snap) : [];
  const batches = batchesRaw.map(normalizeBatch).filter((b) => b.team !== "unknown_team");

  // Totals si présents dans le snapshot (sinon on calcule)
  const totalsFromSnap = snap?.totals ?? snap?.summary ?? null;
  const totalPoints =
    totalsFromSnap?.points != null
      ? num(totalsFromSnap.points, 0)
      : batches.reduce((a, b) => a + (b.points || 0), 0);

  const totalBatches = batches.length;

  // Aggr par team
  const map = new Map<string, TeamAgg>();
  for (const b of batches) {
    const cur = map.get(b.team) || {
      team: b.team,
      kind: inferTeamKind(b.team),
      batches: 0,
      points: 0,
      lastTs: "",
      lastCid: "",
      lastTx: "",
    };
    cur.batches += 1;
    cur.points += b.points || 0;

    // lastTs: max iso
    if (!cur.lastTs || (b.ts && b.ts > cur.lastTs)) {
      cur.lastTs = b.ts || cur.lastTs;
      cur.lastCid = b.cid || cur.lastCid;
      cur.lastTx = b.tx || cur.lastTx;
    }
    map.set(b.team, cur);
  }

  const teams = Array.from(map.values()).sort((a, b) => b.points - a.points);

  // “External” estimation (sans supposer une source officielle):
  // on compte "core" vs non-core via inferTeamKind.
  const externalPoints = teams
    .filter((t) => t.kind !== "core")
    .reduce((a, t) => a + t.points, 0);
  const externalRatio = totalPoints > 0 ? (externalPoints * 100) / totalPoints : 0;

  // Dernier batch global
  const lastGlobal = batches
    .slice()
    .sort((a, b) => (a.ts > b.ts ? -1 : a.ts < b.ts ? 1 : 0))[0];

  return (
    <main className="relative min-h-screen bg-[#020617] px-4 py-8 text-white">
      {/* Background */}
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
              RWA Monitoring · Mainnet
            </div>
            <h1 className="mt-3 bg-gradient-to-r from-[#14F195] via-[#39D0D8] to-[#9945FF] bg-clip-text text-2xl font-semibold text-transparent sm:text-3xl">
              On-chain RWA overview powered by Wakama Oracle
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-white/65 sm:text-sm">
              Reads <span className="font-mono text-white/80">/public/now_mainnet_v2.json</span> (built from mainnet
              receipts) and renders teams + latest batches with IPFS and Solana Explorer links.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/rwa"
              className="rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-xs text-white/80 hover:border-[#39D0D8]/70 hover:text-[#39D0D8]"
            >
              Devnet view
            </Link>
            <Link
              href="/now-playing"
              className="rounded-full bg-gradient-to-r from-[#14F195] to-[#39D0D8] px-4 py-1.5 text-xs font-semibold text-black hover:opacity-95"
            >
              Live oracle stream
            </Link>
          </div>
        </header>

        {/* Warning if snapshot missing */}
        {!snap ? (
          <section className="rounded-2xl border border-red-400/20 bg-red-500/5 p-4">
            <div className="text-sm font-semibold text-red-200">Snapshot not found</div>
            <div className="mt-1 text-[12px] text-white/70">
              File missing: <span className="font-mono">public/now_mainnet_v2.json</span>. Build it from receipts and
              push to the dashboard repo.
            </div>
          </section>
        ) : null}

        {/* KPIs */}
        <section className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="text-xs text-white/60">Teams (mainnet)</div>
            <div className="mt-1 text-2xl font-semibold">{teams.length}</div>
            <div className="mt-2 text-[11px] text-white/55">Core + external partners.</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="text-xs text-white/60">Batches indexed</div>
            <div className="mt-1 text-2xl font-semibold">{totalBatches}</div>
            <div className="mt-2 text-[11px] text-white/55">Lots published on mainnet.</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="text-xs text-white/60">Total points</div>
            <div className="mt-1 text-2xl font-semibold">{totalPoints.toLocaleString()}</div>
            <div className="mt-2 text-[11px] text-white/55">Sum of batch point counts.</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="text-xs text-white/60">External ratio (est.)</div>
            <div className="mt-1 text-2xl font-semibold">{externalRatio.toFixed(2)}%</div>
            <div className="mt-2 text-[11px] text-white/55">Computed from team naming heuristic.</div>
          </div>
        </section>

        {/* Latest batch card */}
        <section className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-white/90">Latest mainnet batch</div>
            <div className="text-[11px] text-white/55">
              Last timestamp:{" "}
              <span className="font-mono text-white/75">{lastGlobal?.ts ?? "—"}</span>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-[11px] text-white/55">Team</div>
              <div className="mt-1 font-medium">{lastGlobal?.team ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-[11px] text-white/55">Points</div>
              <div className="mt-1 font-medium">{num(lastGlobal?.points, 0).toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-[11px] text-white/55">CID</div>
              <div className="mt-1 font-mono text-[12px]">{compact(lastGlobal?.cid)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-[11px] text-white/55">Tx</div>
              <div className="mt-1 font-mono text-[12px]">{compact(lastGlobal?.tx)}</div>
            </div>
          </div>

          {lastGlobal?.cid || lastGlobal?.tx ? (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {lastGlobal?.cid ? (
                <a
                  href={`https://ipfs.io/ipfs/${lastGlobal.cid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/20 px-3 py-1 hover:border-[#14F195]/70 hover:text-[#14F195]"
                >
                  IPFS · {compact(lastGlobal.cid)}
                </a>
              ) : null}
              {lastGlobal?.tx ? (
                <a
                  href={`https://explorer.solana.com/tx/${lastGlobal.tx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/20 px-3 py-1 hover:border-[#39D0D8]/70 hover:text-[#39D0D8]"
                >
                  Solana tx · {compact(lastGlobal.tx)}
                </a>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Teams table */}
        <section className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white/90">Teams (mainnet)</h2>
            <div className="text-[11px] text-white/55">
              Source: <span className="font-mono">now_mainnet_v2.json</span>
            </div>
          </div>

          <div className="overflow-x-auto text-xs sm:text-sm">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/60">
                  <th className="px-2 py-2 text-left">Team</th>
                  <th className="px-2 py-2 text-left">Badge</th>
                  <th className="px-2 py-2 text-left">Points</th>
                  <th className="px-2 py-2 text-left">Batches</th>
                  <th className="px-2 py-2 text-left">Last day</th>
                  <th className="px-2 py-2 text-left">Links</th>
                </tr>
              </thead>
              <tbody>
                {teams.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-3 text-[11px] text-white/45">
                      No teams found in snapshot.
                    </td>
                  </tr>
                ) : (
                  teams.map((t) => {
                    const badge = badgeClass(t.kind as any);
                    return (
                      <tr key={t.team} className="border-b border-white/10 last:border-0">
                        <td className="px-2 py-2 font-medium">{t.team}</td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${badge}`}>
                            {(t.kind || "other").toUpperCase()}
                          </span>
                        </td>
                        <td className="px-2 py-2">{t.points.toLocaleString()}</td>
                        <td className="px-2 py-2">{t.batches}</td>
                        <td className="px-2 py-2">{isoDay(t.lastTs)}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-1 text-[11px]">
                            {t.lastCid ? (
                              <a
                                href={`https://ipfs.io/ipfs/${t.lastCid}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-white/20 px-2 py-0.5 hover:border-[#14F195]/70 hover:text-[#14F195]"
                              >
                                IPFS
                              </a>
                            ) : null}
                            {t.lastTx ? (
                              <a
                                href={`https://explorer.solana.com/tx/${t.lastTx}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-white/20 px-2 py-0.5 hover:border-[#39D0D8]/70 hover:text-[#39D0D8]"
                              >
                                Solana tx
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Raw batches (last 50) */}
        <section className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white/90">Latest batches (mainnet)</h2>
            <div className="text-[11px] text-white/55">Showing last 50 (by ts)</div>
          </div>

          <div className="overflow-x-auto text-xs sm:text-sm">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/60">
                  <th className="px-2 py-2 text-left">Day</th>
                  <th className="px-2 py-2 text-left">Team</th>
                  <th className="px-2 py-2 text-left">Points</th>
                  <th className="px-2 py-2 text-left">CID</th>
                  <th className="px-2 py-2 text-left">Tx</th>
                </tr>
              </thead>
              <tbody>
                {batches
                  .slice()
                  .sort((a, b) => (a.ts > b.ts ? -1 : a.ts < b.ts ? 1 : 0))
                  .slice(0, 50)
                  .map((b, i) => (
                    <tr key={`${b.team}-${b.ts}-${i}`} className="border-b border-white/10 last:border-0">
                      <td className="px-2 py-2">{isoDay(b.ts)}</td>
                      <td className="px-2 py-2 font-medium">{b.team}</td>
                      <td className="px-2 py-2">{num(b.points, 0).toLocaleString()}</td>
                      <td className="px-2 py-2">
                        {b.cid ? (
                          <a
                            href={`https://ipfs.io/ipfs/${b.cid}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[11px] text-white/80 hover:text-[#14F195]"
                            title={b.cid}
                          >
                            {compact(b.cid)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {b.tx ? (
                          <a
                            href={`https://explorer.solana.com/tx/${b.tx}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[11px] text-white/80 hover:text-[#39D0D8]"
                            title={b.tx}
                          >
                            {compact(b.tx)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-[11px] text-white/55">
              Note: This view is snapshot-based. Update it by rebuilding{" "}
              <span className="font-mono text-white/70">now_mainnet_v2.json</span> from receipts and pushing the dashboard.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}