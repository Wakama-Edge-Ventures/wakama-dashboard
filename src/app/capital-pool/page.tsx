// app/capital-pool/page.tsx
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

    // If server returned non-JSON or null, still return a safe object
    if (!j) return { ok: false, error: `Invalid JSON response (HTTP ${r.status})`, rows: [] };

    // If HTTP not ok, keep payload but mark ok=false
    if (!r.ok) return { ...j, ok: false, error: j.error ?? `HTTP ${r.status}` };

    // Normal case
    return { ...j, ok: j.ok ?? true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e), rows: [] };
  }
};

function fmtDate(ts: number | null) {
  if (ts == null) return "-";
  return new Date(ts * 1000).toISOString().replace("T", " ").replace("Z", " UTC");
}

export default function CapitalPoolPage() {
  const { data, error, isLoading } = useSWR<ApiResponse>(
    "/api/capital-pool?limit=20",
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      // prevent unnecessary retries storms
      shouldRetryOnError: false,
      errorRetryCount: 0,
    }
  );

  // Only show hard error if we have literally no data
  if (isLoading && !data) return <div className="p-6">Loading…</div>;
  if (error && !data) return <div className="p-6">Error loading data</div>;

  const rows = data?.rows ?? [];
  const total = Number(data?.totalDeposits ?? 0);

  return (
    <div className="p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Wakama Capital Pool</h1>
        <div className="text-sm opacity-70">
          Updated: {data?.generatedAt ? String(data.generatedAt) : "-"}
        </div>
      </div>

      {/* Fallback / degraded mode banner */}
      {data?.ok === false && (
        <div className="mt-3 rounded-2xl border p-3 text-sm">
          <div className="font-medium">Degraded mode</div>
          <div className="opacity-80">
            {data?.fallback ? `Source: ${data.fallback}. ` : ""}
            {data?.error ? `Error: ${data.error}` : ""}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border p-4">
          <div className="text-sm opacity-70">Total deposits (computed)</div>
          <div className="text-xl font-semibold">{total.toFixed(6)} USDC</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm opacity-70">Rows</div>
          <div className="text-xl font-semibold">{rows.length}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm opacity-70">Vault ATA</div>
          <div className="text-xs break-all">{data?.vaultAta ?? "-"}</div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-black/5">
            <tr>
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
            {rows.map((r) => {
              const amt = Number(r.amountUsdc ?? 0);
              const pct = total > 0 && amt > 0 ? (amt / total) * 100 : 0;

              return (
                <tr key={r.signature} className="border-t">
                  <td className="p-3 whitespace-nowrap">{fmtDate(r.blockTime)}</td>
                  <td className="p-3">{r.teamLabel ?? r.teamId ?? "unknown"}</td>
                  <td className="p-3">{r.type}</td>
                  <td className="p-3 text-right font-medium">{amt.toFixed(6)}</td>
                  <td className="p-3 text-right">{pct ? `${pct.toFixed(2)}%` : "-"}</td>
                  <td className="p-3 max-w-[420px] truncate" title={r.memo ?? ""}>
                    {r.memo ?? "-"}
                  </td>
                  <td className="p-3">
                    <a
                      className="underline"
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
                <td className="p-6 opacity-60" colSpan={7}>
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}