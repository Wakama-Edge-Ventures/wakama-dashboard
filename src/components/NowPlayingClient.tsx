'use client';

import { useMemo, useState, useEffect } from 'react';
import SearchBar from './SearchBar';
import TxHistory from './TxHistory';
import RefreshButton from '@/components/RefreshButton';

type Totals = { files: number; cids: number; onchainTx: number; lastTs: string };
type NowItem = {
  cid: string;
  tx?: string;
  file?: string;
  sha256?: string;
  ts?: string;
  status?: string;
  slot?: number | null;
  source?: string;
};
type Now = { totals: Totals; items: NowItem[] };

function shorten(s = '', head = 10, tail = 8) {
  if (!s || s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/**
 * Classification plus fine pour Amira.
 *
 * Règles :
 * - filename contient "coop" ou "delivery"     -> "Coop delivery"
 * - filename contient "sensor_batch"           -> "Sensor batch (field)"
 * - source === simulated ET filename commence par "sensor_" -> "Sensor batch (field)"
 * - tx présent                                  -> "On-chain (publisher)"
 * - cid === QmPLACEHOLDER                       -> "RWA template"
 * - sinon                                       -> "Unknown"
 */
function getRecordType(it: NowItem): string {
  // 1. priorité au champ explicite
  if ((it as any).rwa_kind) {
    const rk = String((it as any).rwa_kind).toLowerCase();
    if (rk === 'sensor_batch') return 'Sensor batch (field)';
    if (rk === 'coop_delivery') return 'Coop delivery';
    return `RWA: ${rk}`;
  }

  // 2. anciens heuristiques
  if (it.cid === 'QmPLACEHOLDER') return 'RWA template';
  if ((it.source || '').toLowerCase() === 'simulated') return 'Simulated RWA';
  if ((it.source || '').toLowerCase() === 'ingest') return 'Ingest batch';
  if (it.tx && it.tx.length > 0) return 'On-chain (publisher)';
  return 'Unknown';
}

function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: React.ReactNode;
  tone?: 'ok' | 'warn' | 'neutral';
  title?: string;
}) {
  const map: Record<string, string> = {
    ok: 'bg-emerald-400/15 text-emerald-100 border border-emerald-400/20',
    warn: 'bg-yellow-400/15 text-yellow-50 border border-yellow-400/20',
    neutral: 'bg-white/5 text-white/80 border border-white/10',
  };
  const cls = map[tone] || map.neutral;
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ${cls}`}
    >
      {children}
    </span>
  );
}

export default function NowPlayingClient({
  data,
  explorerBase,
  cluster,
  ipfsGateway,
  year,
}: {
  data: Now;
  explorerBase: string;
  cluster: string;
  ipfsGateway: string;
  year: number;
}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [query, setQuery] = useState('');

  // bouton Back to top
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 200);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter((it) => {
      return (
        it.cid?.toLowerCase().includes(q) ||
        it.tx?.toLowerCase().includes(q) ||
        it.file?.toLowerCase().includes(q) ||
        (it.source || '').toLowerCase().includes(q)
      );
    });
  }, [data.items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);

  return (
    <>
      {/* top bar like Solana explorer */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SearchBar
          value={query}
          onChange={setQuery}
          items={data.items}
          placeholder="Search CID, tx, file, source..."
        />
        <RefreshButton label="Refresh" auto intervalMs={15000} />
      </div>

      {/* 2 rows de cards comme Solana */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="text-xs text-white/50 mb-1">Files</div>
          <div className="text-2xl font-semibold text-emerald-300">
            {data.totals.files.toLocaleString()}
          </div>
          <div className="text-[10px] text-white/30 mt-1">Total JSON batches</div>
        </div>
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="text-xs text-white/50 mb-1">Unique CIDs</div>
          <div className="text-2xl font-semibold text-emerald-300">
            {data.totals.cids.toLocaleString()}
          </div>
          <div className="text-[10px] text-white/30 mt-1">
            IPFS gateway: {new URL(ipfsGateway).host}
          </div>
        </div>
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="text-xs text-white/50 mb-1">On-chain (Devnet)</div>
          <div className="text-2xl font-semibold text-emerald-300">
            {data.totals.onchainTx.toLocaleString()}
          </div>
          <div className="text-[10px] text-white/30 mt-1">Explorer: {cluster}</div>
        </div>
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="text-xs text-white/50 mb-1">Last batch</div>
          <div className="text-sm font-medium text-white">
            {data.totals.lastTs || '—'}
          </div>
          <div className="text-[10px] text-emerald-300 mt-1">Live</div>
        </div>
      </div>

      {/* chart + small info */}
      <div className="mb-6 grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">Transaction Stats History</h2>
            <span className="text-[10px] text-white/40">last 20 batches</span>
          </div>
          <TxHistory items={data.items} />
        </div>
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <h2 className="text-sm font-medium text-white mb-3">Sources</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Simulated RWA</span>
              <span className="text-emerald-200">
                {
                  data.items.filter(
                    (i) => (i.source || '').toLowerCase() === 'simulated'
                  ).length
                }
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Ingest batch</span>
              <span className="text-emerald-200">
                {
                  data.items.filter(
                    (i) => (i.source || '').toLowerCase() === 'ingest'
                  ).length
                }
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Coop delivery</span>
              <span className="text-emerald-200">
                {data.items.filter((i) =>
                  (i.file || '').toLowerCase().includes('coop')
                ).length || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Placeholder / template</span>
              <span className="text-emerald-200">
                {data.items.filter((i) => i.cid === 'QmPLACEHOLDER').length || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-base font-medium">Latest items</h2>
          <div className="flex items-center gap-2 text-[11px] text-white/50">
            <label className="flex items-center gap-1">
              Rows:
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded bg-[#0A0B1A] border border-white/10 px-1.5 py-0.5 text-[11px]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <span>
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-white/10 text-left text-white/80">
              <tr>
                <th className="px-4 py-2.5">CID</th>
                <th className="px-4 py-2.5">Tx</th>
                <th className="px-4 py-2.5">File</th>
                <th className="px-4 py-2.5">SHA-256</th>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5">Record type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {visible.map((it, i) => {
                const recordType = getRecordType(it);
                const toneForRecord =
                  recordType === 'On-chain (publisher)'
                    ? 'ok'
                    : recordType === 'Coop delivery'
                    ? 'neutral'
                    : recordType === 'Sensor batch (field)'
                    ? 'neutral'
                    : recordType.includes('RWA')
                    ? 'neutral'
                    : 'warn';

                return (
                  <tr key={`${it.cid}-${it.tx ?? ''}-${i}`} className="hover:bg-[#14F195]/5">
                    <td className="px-4 py-2.5 font-mono">
                      <a
                        href={`${ipfsGateway.replace(/\/+$/, '')}/${it.cid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-dotted underline-offset-4 hover:text-[#14F195]"
                        title={it.cid}
                      >
                        {shorten(it.cid, 12, 10)}
                      </a>
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {it.tx ? (
                        <a
                          href={`${explorerBase}/${it.tx}?cluster=${cluster}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-dotted underline-offset-4 hover:text-[#14F195]"
                          title={it.tx}
                        >
                          {shorten(it.tx, 10, 10)}
                        </a>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {it.file ? (
                        <span title={it.file} className="font-medium text-white">
                          {shorten(it.file, 20, 16)}
                        </span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {it.sha256 ? (
                        <span title={it.sha256}>{shorten(it.sha256, 12, 12)}</span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {it.ts ? <span className="text-white">{it.ts}</span> : <span className="text-white/40">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {(() => {
                        const s = (it.status || '').toLowerCase();
                        const tone: 'ok' | 'warn' | 'neutral' =
                          s.includes('confirmed') ? 'ok' : s === 'n/a' ? 'neutral' : 'warn';
                        return (
                          <div className="flex items-center gap-2">
                            <Badge tone={tone}>{it.status || '—'}</Badge>
                            {typeof it.slot === 'number' ? (
                              <span className="text-[11px] text-white/40">slot {it.slot}</span>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2.5">
                      {it.source ? (
                        <Badge tone="neutral" title="Receipt source">
                          {it.source}
                        </Badge>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={toneForRecord} title="Classified by dashboard">
                        {recordType}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="mt-4 flex items-center justify-between text-[11px] text-white/50">
          <div>
            Page {pageClamped} / {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageClamped === 1}
              className="rounded border border-white/10 px-3 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageClamped === totalPages}
              className="rounded border border-white/10 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-[11px] text-white/60 pb-10">
        <span>
          © {year}{' '}
          <a
            href="https://wakama.farm"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-4 hover:text-[#14F195]"
          >
            Wakama.farm
          </a>{' '}
          supported by{' '}
          <a
            href="https://solana.org"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-4 hover:text-[#14F195]"
          >
            Solana Foundation
          </a>
        </span>
        <a
          href="/"
          className="rounded-lg border border-white/15 px-2 py-1 hover:bg-[#14F195]/15 transition-colors"
        >
          Home
        </a>
      </footer>

      {/* back to top */}
      {showTop ? (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 rounded-full bg-[#14F195] text-black shadow-lg hover:scale-105 transition-transform px-4 py-2 text-sm"
        >
          ↑ Top
        </button>
      ) : null}
    </>
  );
}
