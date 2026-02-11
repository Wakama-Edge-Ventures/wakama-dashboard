// app/capital-pool/page.tsx
"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

type ApiRow = {
  signature: string;
  blockTime: number | null;
  slot: number;
  type: "DEPOSIT" | "SWEEP" | "OTHER";
  amountUsdc: number;
  teamId: string | null;
  teamLabel: string | null;
  memo: string | null;
};

type ApiRpcRow = {
  signature: string;
  blockTime: number | null;
  slot: number;
  type: "DEPOSIT" | "SWEEP" | "OTHER";
  amountUsdc: number;
  teamId: string | null;
  teamLabel: string | null;
  memo: string | null;
};

type ApiResponse = {
  ok?: boolean;
  mode?: string;
  fallback?: string;
  error?: string;
  generatedAt?: string;
  vaultAta?: string;
  totalDeposits?: number;
  rows?: ApiRow[];
  rpcRows?: ApiRpcRow[];
};

const fetcher = async (url: string): Promise<ApiResponse> => {
  try {
    const r = await fetch(url, { cache: "no-store" });
    const j = (await r.json().catch(() => null)) as ApiResponse | null;
    if (!j) return { ok: false, error: `Invalid JSON (HTTP ${r.status})`, rows: [] };
    if (!r.ok) return { ...j, ok: false, error: j.error ?? `HTTP ${r.status}` };
    return { ...j, ok: j.ok ?? true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e), rows: [] };
  }
};

function fmtDate(ts: number | null) {
  if (ts == null) return "-";
  // display in UTC like other pages
  return new Date(ts * 1000).toISOString().replace("T", " ").replace("Z", " UTC");
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function roundTo(n: number, step: number) {
  return Math.floor(n / step) * step;
}

export default function CapitalPoolPage() {
  const [page, setPage] = useState(1);
  const [range, setRange] = useState<"30m" | "2h" | "12h">("30m");

  const { data, error, isLoading } = useSWR<ApiResponse>("/api/capital-pool?limit=200", fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
    errorRetryCount: 0,
  });

  const enriched = useMemo(() => {
    const rows = data?.rows ?? [];
    const rpcRows = data?.rpcRows ?? [];

    const bySig = new Map<string, { blockTime: number | null; slot: number }>();
    for (const r of rpcRows) {
      if (!r?.signature) continue;
      bySig.set(r.signature, { blockTime: r.blockTime ?? null, slot: r.slot ?? 0 });
    }

    const out = rows.map((r) => {
      const hit = bySig.get(r.signature);
      const blockTime = r.blockTime ?? hit?.blockTime ?? null;
      const slot = r.slot ?? hit?.slot ?? 0;
      return { ...r, blockTime, slot };
    });

    // newest first
    out.sort((a, b) => {
      const ta = a.blockTime ?? 0;
      const tb = b.blockTime ?? 0;
      if (tb !== ta) return tb - ta;
      return (b.slot ?? 0) - (a.slot ?? 0);
    });

    return out;
  }, [data?.rows, data?.rpcRows]);

  const total = Number(data?.totalDeposits ?? 0);

  // pagination
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(enriched.length / pageSize));
  const safePage = clamp(page, 1, totalPages);
  const start = (safePage - 1) * pageSize;
  const paged = enriched.slice(start, start + pageSize);

  // chart settings
  const target = 20000;
  const yMax = 30000;

  const chart = useMemo(() => {
    // prefer generatedAt as "now" anchor (stable), fallback to Date.now
    const nowSec = data?.generatedAt ? Math.floor(new Date(data.generatedAt).getTime() / 1000) : Math.floor(Date.now() / 1000);

    const windowSec = range === "30m" ? 30 * 60 : range === "2h" ? 2 * 60 * 60 : 12 * 60 * 60;
    const stepSec = range === "30m" ? 60 : range === "2h" ? 5 * 60 : 60 * 60;

    const fromSec = nowSec - windowSec;

    // build deposit events (positive only) with timestamps
    const events = (data?.rows ?? [])
      .map((r) => {
        // enrich time from rpcRows map as well (same as table)
        let t = r.blockTime;
        if (t == null) {
          const hit = (data?.rpcRows ?? []).find((x) => x.signature === r.signature);
          t = hit?.blockTime ?? null;
        }
        return { t: t ?? null, amt: Number(r.amountUsdc ?? 0) };
      })
      .filter((x) => x.t != null && x.amt > 0) as { t: number; amt: number }[];

    events.sort((a, b) => a.t - b.t);

    // cumulative totals per bucket end
    const buckets: { t: number; label: string; cum: number }[] = [];

    // start aligned for nice labels
    const firstBucketEnd = roundTo(fromSec, stepSec) + stepSec;
    let cum = 0;

    // pre-sum events before window (so cum is global cum)
    for (const e of events) {
      if (e.t < fromSec) cum += e.amt;
      else break;
    }

    for (let t = firstBucketEnd; t <= nowSec; t += stepSec) {
      // add events up to bucket end
      while (events.length && events[0].t <= t) {
        const e = events.shift()!;
        if (e.t >= fromSec) cum += e.amt;
        // if it was <fromSec it would have been already counted, but we shifted only after sort, so safe.
      }

      // label: HH:MM
      const d = new Date(t * 1000);
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      const label = `${hh}:${mm}`;

      buckets.push({ t, label, cum });
    }

    // compute stacked values
    const points = buckets.map((b) => {
      const deposit = b.cum;
      const remaining = Math.max(0, target - deposit);
      return { ...b, deposit, remaining };
    });

    return { points };
  }, [data?.rows, data?.rpcRows, data?.generatedAt, range]);

  // reset page if data length changes
  useMemo(() => {
    if (safePage !== page) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  if (isLoading && !data) {
    return <div className="p-6">Loading…</div>;
  }
  if (error && !data) {
    return <div className="p-6">Error loading data</div>;
  }

  return (
    <div className="p-6">
      {/* Header aligned with dashboard mood */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/80">
            WAKAMA ORACLE • CAPITAL POOL
          </div>
          <h1 className="mt-3 bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-300 bg-clip-text text-3xl font-semibold text-transparent">
            Wakama Capital Pool (Mainnet)
          </h1>

          <div className="mt-2 text-sm text-white/60">
            Updated: <span className="text-white/80">{data?.generatedAt ? String(data.generatedAt) : "-"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Mainnet
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            GW:{" "}
            <span className="font-mono text-white/80">
              {process.env.NEXT_PUBLIC_IPFS_GATEWAY ? new URL(process.env.NEXT_PUBLIC_IPFS_GATEWAY).host : "gateway.pinata.cloud"}
            </span>
          </div>
        </div>
      </div>

      {/* Degraded mode banner */}
      {data?.ok === false && (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium text-amber-200">Degraded mode</div>
            {data?.fallback && (
              <div className="rounded-full border border-amber-400/20 bg-black/20 px-3 py-1 text-xs text-amber-100/80">
                Source: {data.fallback}
              </div>
            )}
          </div>
          {data?.error && <div className="mt-2 text-amber-100/80">{data.error}</div>}
        </div>
      )}

      {/* Stats cards */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="text-sm text-white/60">Total deposits (computed)</div>
          <div className="mt-2 text-2xl font-semibold text-white">{total.toFixed(6)} USDC</div>
          <div className="mt-1 text-xs text-white/50">Target: {target.toLocaleString()} USDC</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/60">Transactions</div>
          <div className="mt-2 text-2xl font-semibold text-white">{enriched.length}</div>
          <div className="mt-1 text-xs text-white/50">
            Showing {pageSize}/page • Page {safePage}/{totalPages}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/60">Vault ATA</div>
          <div className="mt-2 break-all font-mono text-xs text-white/80">{data?.vaultAta ?? "-"}</div>
        </div>
      </div>

      {/* TABLE (top) */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="text-sm font-medium text-white/80">Latest transactions</div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/80 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              Prev
            </button>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/70">
              {safePage}/{totalPages}
            </div>
            <button
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/80 disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/20">
              <tr className="text-white/70">
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Team</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-right">Amount (USDC)</th>
                <th className="p-3 text-right">% total</th>
                <th className="p-3 text-left">Memo / Comment</th>
                <th className="p-3 text-left">Tx</th>
              </tr>
            </thead>

            <tbody>
              {paged.map((r) => {
                const amt = Number(r.amountUsdc ?? 0);
                const pct = total > 0 && amt > 0 ? (amt / total) * 100 : 0;

                const team = r.teamLabel ?? r.teamId ?? "unknown";
                const teamPill =
                  team === "MKS"
                    ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                    : team === "ETRA"
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                      : "border-white/10 bg-white/5 text-white/70";

                const typePill =
                  r.type === "DEPOSIT"
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                    : r.type === "SWEEP"
                      ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                      : "border-white/10 bg-white/5 text-white/70";

                return (
                  <tr key={r.signature} className="border-t border-white/10 text-white/80">
                    <td className="p-3 whitespace-nowrap font-mono text-xs text-white/70">{fmtDate(r.blockTime)}</td>

                    <td className="p-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${teamPill}`}>
                        {team}
                      </span>
                    </td>

                    <td className="p-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${typePill}`}>
                        {r.type}
                      </span>
                    </td>

                    <td className="p-3 text-right font-medium text-white">{amt.toFixed(6)}</td>

                    <td className="p-3 text-right text-white/70">{pct ? `${pct.toFixed(2)}%` : "-"}</td>

                    <td className="p-3 max-w-[420px] truncate text-white/70" title={r.memo ?? ""}>
                      {r.memo ?? "-"}
                    </td>

                    <td className="p-3">
                      <a
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/80 hover:bg-black/30"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://solscan.io/tx/${r.signature}`}
                      >
                        solscan
                        <span className="text-white/40">↗</span>
                      </a>
                    </td>
                  </tr>
                );
              })}

              {!paged.length && (
                <tr>
                  <td className="p-6 text-white/50" colSpan={7}>
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CHART (below) */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-white/80">Capital Pool progress</div>
            <div className="mt-1 text-xs text-white/50">
              Stacked bars: green = deposits, mauve = remaining to {target.toLocaleString()} USDC
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-1">
            <button
              className={`rounded-lg px-3 py-1.5 text-xs ${range === "30m" ? "bg-emerald-400/20 text-emerald-200" : "text-white/70"}`}
              onClick={() => setRange("30m")}
            >
              30m
            </button>
            <button
              className={`rounded-lg px-3 py-1.5 text-xs ${range === "2h" ? "bg-emerald-400/20 text-emerald-200" : "text-white/70"}`}
              onClick={() => setRange("2h")}
            >
              2H
            </button>
            <button
              className={`rounded-lg px-3 py-1.5 text-xs ${range === "12h" ? "bg-emerald-400/20 text-emerald-200" : "text-white/70"}`}
              onClick={() => setRange("12h")}
            >
              12H
            </button>
          </div>
        </div>

        {/* chart area */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          {/* y-axis labels */}
          <div className="relative h-[260px]">
            {/* gridlines */}
            {[0, 2000, 4000, 6000, 10000, 20000, 30000].map((v) => {
              const y = 100 - (v / yMax) * 100;
              return (
                <div key={v} className="absolute left-0 right-0" style={{ top: `${y}%` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-14 text-right font-mono text-[11px] text-white/40">{v === 0 ? "0" : v.toLocaleString()}</div>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                </div>
              );
            })}

            {/* bars */}
            <div className="absolute inset-0 ml-16 flex items-end gap-2 pb-6">
              {chart.points.map((p) => {
                const depositH = clamp((p.deposit / yMax) * 100, 0, 100);
                const remainingH = clamp((p.remaining / yMax) * 100, 0, 100);

                return (
                  <div key={p.t} className="flex h-full flex-1 flex-col items-center justify-end">
                    <div className="relative w-full">
                      {/* remaining (mauve) on top */}
                      {p.remaining > 0 && (
                        <div
                          className="w-full rounded-t-lg bg-fuchsia-500/80"
                          style={{ height: `${remainingH}%` }}
                          title={`Remaining: ${p.remaining.toFixed(0)} USDC`}
                        />
                      )}
                      {/* deposit (green) bottom */}
                      <div
                        className={`w-full ${p.remaining > 0 ? "rounded-b-lg" : "rounded-lg"} bg-emerald-400/80`}
                        style={{ height: `${depositH}%` }}
                        title={`Deposits: ${p.deposit.toFixed(2)} USDC`}
                      />
                    </div>

                    <div className="mt-2 w-full truncate text-center font-mono text-[10px] text-white/40">{p.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}