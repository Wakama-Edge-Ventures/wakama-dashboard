// app/capital-pool/page.tsx
"use client";

import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => r.json());

function fmtDate(ts: number | null) {
  if (!ts) return "-";
  return new Date(ts * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", " UTC");
}

export default function CapitalPoolPage() {
  const { data, error, isLoading } = useSWR(
    "/api/capital-pool?limit=100",
    fetcher,
    {
      refreshInterval: 15000, // 15s
      revalidateOnFocus: true,
    }
  );

  if (isLoading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6">Error loading data</div>;

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
          <div className="text-xs break-all">{data?.vaultAta}</div>
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
            {rows.map((r: any) => {
              const pct =
                total > 0 && Number(r.amountUsdc) > 0
                  ? (Number(r.amountUsdc) / total) * 100
                  : 0;

              return (
                <tr key={r.signature} className="border-t">
                  <td className="p-3 whitespace-nowrap">
                    {fmtDate(r.blockTime)}
                  </td>
                  <td className="p-3">{r.teamLabel ?? r.teamId ?? "unknown"}</td>
                  <td className="p-3">{r.type}</td>
                  <td className="p-3 text-right font-medium">
                    {Number(r.amountUsdc).toFixed(6)}
                  </td>
                  <td className="p-3 text-right">
                    {pct ? `${pct.toFixed(2)}%` : "-"}
                  </td>
                  <td
                    className="p-3 max-w-[420px] truncate"
                    title={r.memo ?? ""}
                  >
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