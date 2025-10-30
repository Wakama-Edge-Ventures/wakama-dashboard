'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Badge from './Badge';

const EXPLORER = 'https://explorer.solana.com/tx';
const CLUSTER = 'devnet';

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

function shorten(s = '', head = 10, tail = 8) {
  if (!s || s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export default function NowTable({
  items,
  gw,
}: {
  items: NowItem[];
  gw: string;
}) {
  // pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);

  // recherche
  const [query, setQuery] = useState('');
  const [showAuto, setShowAuto] = useState(false);

  // bouton back to top
  const [showBackTop, setShowBackTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowBackTop(window.scrollY > 200);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      return (
        it.cid?.toLowerCase().includes(q) ||
        it.tx?.toLowerCase().includes(q) ||
        it.file?.toLowerCase().includes(q) ||
        it.source?.toLowerCase().includes(q) ||
        it.status?.toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  // suggestions autocomplete (max 6)
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return items
      .filter(
        (it) =>
          it.cid?.toLowerCase().includes(q) ||
          it.file?.toLowerCase().includes(q) ||
          it.tx?.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [items, query]);

  // pagination calculée
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  function linkIpfs(cid: string) {
    return `${gw}/${cid}`;
  }
  function linkTx(tx: string) {
    return `${EXPLORER}/${tx}?cluster=${CLUSTER}`;
  }

  function statusTone(s?: string): 'ok' | 'warn' | 'neutral' {
    const v = (s || '').toLowerCase();
    if (v.includes('confirmed')) return 'ok';
    if (v === 'n/a' || v === 'na') return 'neutral';
    return 'warn';
  }

  return (
    <div className="relative">
      {/* Barre de recherche style explorer */}
      <div className="relative mb-4">
        <div className="flex items-center rounded-xl border border-[#14F195]/40 bg-black/10 px-3 py-2 backdrop-blur">
          <span className="mr-2 text-white/50">🔎</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowAuto(true);
              setPage(1);
            }}
            onFocus={() => setShowAuto(true)}
            onBlur={() => {
              // petit délai sinon on ne peut pas cliquer sur la suggestion
              setTimeout(() => setShowAuto(false), 160);
            }}
            placeholder="Search by CID, file, tx, source…"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
          <kbd className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
            /
          </kbd>
        </div>

        {/* Autocomplete */}
        {showAuto && suggestions.length > 0 ? (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0A0B1A]/95 backdrop-blur">
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(sug.cid || sug.file || '');
                  setShowAuto(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
              >
                <span className="flex-1 truncate font-mono">
                  {sug.cid ? shorten(sug.cid, 14, 10) : sug.file}
                </span>
                {sug.source ? (
                  <span className="text-[10px] text-white/40">{sug.source}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Tableau */}
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
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-4 text-center text-sm text-white/50"
                >
                  No results.
                </td>
              </tr>
            ) : (
              visible.map((it, i) => (
                <tr
                  key={`${it.cid}-${it.tx ?? ''}-${i}`}
                  className="hover:bg-[#14F195]/10 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono">
                    <a
                      href={linkIpfs(it.cid)}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-dotted underline-offset-4 hover:text-[#14F195] transition-colors"
                      title={it.cid}
                    >
                      {shorten(it.cid, 12, 10)}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 font-mono">
                    {it.tx ? (
                      <a
                        href={linkTx(it.tx)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-dotted underline-offset-4 hover:text-[#14F195] transition-colors"
                        title={it.tx}
                      >
                        {shorten(it.tx, 10, 10)}
                      </a>
                    ) : (
                      <span className="text-white/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {it.file ? (
                      <span title={it.file} className="font-medium text-white">
                        {shorten(it.file, 20, 16)}
                      </span>
                    ) : (
                      <span className="text-white/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono">
                    {it.sha256 ? (
                      <span title={it.sha256}>{shorten(it.sha256, 12, 12)}</span>
                    ) : (
                      <span className="text-white/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {it.ts ? (
                      <span className="text-white">{it.ts}</span>
                    ) : (
                      <span className="text-white/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge tone={statusTone(it.status)}>{it.status || '—'}</Badge>
                      {typeof it.slot === 'number' ? (
                        <span className="text-[11px] text-white/60">
                          slot {it.slot}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {it.source ? (
                      <Badge tone="neutral" title="Receipt source">
                        {it.source}
                      </Badge>
                    ) : (
                      <span className="text-white/50">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/50">
        <div>
          Showing {visible.length} of {filtered.length} items
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-white/80 disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-white/60">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-white/80 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>

      {/* Back to top */}
      {showBackTop ? (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-5 right-5 z-30 rounded-full bg-[#14F195] px-3 py-2 text-xs font-semibold text-black shadow-lg shadow-[#14F195]/40 hover:scale-[1.03] transition"
        >
          ↑ Top
        </button>
      ) : null}
    </div>
  );
}
