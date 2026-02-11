// src/app/capital-pool/page.tsx
"use client";

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

type ApiResponse = {
  ok?: boolean;
  mode?: string;
  fallback?: string;
  error?: string;
  generatedAt?: string;
  vaultAta?: string;
  totalDeposits?: number;
  rows?: ApiRow[];
};

const fetcher = async (url: string): Promise<ApiResponse> => {
  try {
    const r = await fetch(url, { cache: "no-store" });
    const j = (await r.json().catch(() => null)) as ApiResponse | null;

    if (!j) return { ok: false, error: `Invalid JSON response (HTTP ${r.status})`, rows: [] };
    if (!r.ok) return { ...j, ok: false, error: j.error ?? `HTTP ${r.status}` };
    return { ...j, ok: j.ok ?? true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e), rows: [] };
  }
};

function fmtDate(ts: number | null) {
  if (ts == null) return "-";
  return new Date(ts * 1000).toISOString().replace("T", " ").replace("Z", " UTC");
}

function shortKey(s?: string | null) {
  if (!s) return "-";
  if (s.length <= 18) return s;
  return `${s.slice(0, 6)}…${s.slice(-6)}`;
}

function fmtUsdc(n: number) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0.000000";
  return x.toFixed(6);
}

function pctOf(amount: number, total: number) {
  if (!(total > 0) || !(amount > 0)) return null;
  return (amount / total) * 100;
}

function typeChip(type: ApiRow["type"]) {
  if (type === "DEPOSIT")
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25";
  if (type === "SWEEP") return "bg-rose-500/15 text-rose-200 ring-rose-500/25";
  return "bg-slate-500/15 text-slate-200 ring-slate-500/25";
}

function teamChip(label?: string | null) {
  const v = (label ?? "").toUpperCase();
  if (v.includes("MKS")) return "bg-cyan-500/15 text-cyan-200 ring-cyan-500/25";
  if (v.includes("ETRA")) return "bg-violet-500/15 text-violet-200 ring-violet-500/25";
  return "bg-slate-500/15 text-slate-200 ring-slate-500/25";
}

export default function CapitalPoolPage() {
  const { data, error, isLoading } = useSWR<ApiResponse>(
    "/api/capital-pool?limit=50",
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
    }
  );

  const rows = data?.rows ?? [];
  const total = Number(data?.totalDeposits ?? 0);

  // render states (avoid “infinite loading” feeling)
  const showSkeleton = isLoading && !data;
  const hardError = (error && !data) || (!showSkeleton && !data);

  if (showSkeleton) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="h-7 w-64 rounded-lg bg-white/10" />
          <div className="mt-2 h-4 w-80 rounded-lg bg-white/5" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-24 rounded-2xl border border-white/10 bg-white/5" />
          <div className="h-24 rounded-2xl border border-white/10 bg-white/5" />
          <div className="h-24 rounded-2xl border border-white/10 bg-white/5" />
        </div>
        <div className="mt-6 h-96 rounded-2xl border border-white/10 bg-white/5" />
      </div>
    );
  }

  if (hardError) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-100">
          Error loading data.
        </div>
      </div>
    );
  }

  const updatedLabel = data?.generatedAt ? String(data.generatedAt) : "-";
  const vaultAta = data?.vaultAta ?? "-";

  return (
    <div className="p-6">
      {/* Header (aligned with “Now Playing” mood) */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute left-1/3 top-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/60">Wakama Oracle • Capital Pool</div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Wakama Capital Pool</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
              Updated: {updatedLabel}
            </span>
            <a
              href="/capital-pool/mainnet/summary.json"
              className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10 hover:bg-white/10"
            >
              View summary
            </a>
          </div>
        </div>

        {/* Degraded mode banner */}
        {data?.ok === false && (
          <div className="relative mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
            <div className="font-medium">Degraded mode</div>
            <div className="mt-1 text-white/80">
              {data?.fallback ? `Source: ${data.fallback}. ` : ""}
              {data?.error ? `Error: ${data.error}` : ""}
            </div>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm text-white/60">Total deposits</div>
          <div className="mt-1 text-xl font-semibold text-white">{fmtUsdc(total)} USDC</div>
          <div className="mt-2 text-xs text-white/50">Computed from receipts / RPC.</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm text-white/60">Rows</div>
          <div className="mt-1 text-xl font-semibold text-white">{rows.length}</div>
          <div className="mt-2 text-xs text-white/50">Latest transactions in the table.</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm text-white/60">Vault ATA</div>
          <div className="mt-1 font-mono text-xs text-white/80">{vaultAta}</div>
          <div className="mt-2 text-xs text-white/50">Short: {shortKey(vaultAta)}</div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="text-sm font-medium text-white">Transactions</div>
          <div className="text-xs text-white/60">
            Refresh: <span className="text-white/80">15s</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/20">
              <tr className="text-white/70">
                <th className="p-3 text-left font-medium">Date</th>
                <th className="p-3 text-left font-medium">Team</th>
                <th className="p-3 text-left font-medium">Type</th>
                <th className="p-3 text-right font-medium">Amount (USDC)</th>
                <th className="p-3 text-right font-medium">% total</th>
                <th className="p-3 text-left font-medium">Memo / Comment</th>
                <th className="p-3 text-left font-medium">Tx</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const amt = Number(r.amountUsdc ?? 0);
                const pct = pctOf(amt, total);

                return (
                  <tr key={r.signature} className="border-t border-white/10 text-white/85 hover:bg-white/[0.03]">
                    <td className="p-3 whitespace-nowrap font-mono text-xs text-white/70">
                      {fmtDate(r.blockTime)}
                    </td>

                    <td className="p-3">
                      <span
                        className={[
                          "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs ring-1",
                          teamChip(r.teamLabel ?? r.teamId ?? null),
                        ].join(" ")}
                        title={r.teamId ?? ""}
                      >
                        {(r.teamLabel ?? r.teamId ?? "unknown").toString()}
                      </span>
                    </td>

                    <td className="p-3">
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1",
                          typeChip(r.type),
                        ].join(" ")}
                      >
                        {r.type}
                      </span>
                    </td>

                    <td className="p-3 text-right font-semibold tabular-nums text-white">
                      {fmtUsdc(amt)}
                    </td>

                    <td className="p-3 text-right tabular-nums text-white/80">
                      {pct != null ? `${pct.toFixed(2)}%` : "-"}
                    </td>

                    <td className="p-3 max-w-[520px]">
                      <div className="truncate text-white/80" title={r.memo ?? ""}>
                        {r.memo ?? "-"}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-white/45">
                        {shortKey(r.signature)}
                      </div>
                    </td>

                    <td className="p-3">
                      <a
                        className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/80 ring-1 ring-white/10 hover:bg-white/10"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://solscan.io/tx/${r.signature}`}
                      >
                        solscan
                      </a>
                    </td>
                  </tr>
                );
              })}

              {!rows.length && (
                <tr>
                  <td className="p-6 text-center text-white/60" colSpan={7}>
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-white/10 px-4 py-3 text-xs text-white/50">
          Tip: memo strings can be displayed here once deposits include a memo convention (e.g.{" "}
          <span className="font-mono text-white/70">team=team_etra; purpose=...</span>).
        </div>
      </div>
    </div>
  );
}