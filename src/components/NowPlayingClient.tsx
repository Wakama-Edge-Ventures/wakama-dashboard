'use client';

import { useMemo, useState, useEffect, type ReactNode } from 'react';
import SearchBar from './SearchBar';
import TxHistory from './TxHistory';
import RefreshButton from '@/components/RefreshButton';
import Link from 'next/link';

// ---- Types locaux (côté client) ----
type Totals = { files: number; cids: number; onchainTx: number; lastTs: string };

type PointsSummary = {
  totalPoints: number;
  externalPoints: number;
  externalPct: number;
  byTeam: Record<string, number>;
  bySource: Record<string, number>;
};

type NowItem = {
  cid: string;
  tx?: string;
  file?: string;
  sha256?: string;
  ts?: string;
  status?: string;
  slot?: number | null;
  source?: string;
  team?: string;
  points?: number;
  count?: number;  
  recordType?: string;
  rwa_kind?: string;
};


type Now = { totals: Totals; items: NowItem[]; pointsSummary?: PointsSummary };

function shorten(s = '', head = 10, tail = 8) {
  if (!s || s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

// format numérique stable (évite mismatch 154,364 vs 154 364)
const formatNumber = (n: number) => n.toLocaleString('en-US');

/**
 * Mapping équipes -> URL GitHub.
 */
const TEAM_LINKS: Record<string, string> = {
  Wakama_team: 'https://github.com/Wakama-Edge-Ventures',
  'team-techlab-cme': 'https://github.com/Techlab-cme-bingerville',
  'team-makm2': 'https://github.com/makm2',
  'team-scak-coop': 'https://github.com/SCAK-COOP-CA',
};

/**
 * Labels lisibles pour chaque équipe.
 */
const TEAM_LABELS: Record<string, string> = {
  Wakama_team: 'Wakama team',
  'team-techlab-cme': 'team-techlab-cme',
  'team-makm2': 'team-makm2',
  'team-scak-coop': 'team-scak-coop',
};

function getTeamMeta(teamKey: string) {
  if (!teamKey) {
    return { label: '—', url: '' };
  }
  return {
    label: TEAM_LABELS[teamKey] || teamKey,
    url: TEAM_LINKS[teamKey] || '',
  };
}

/**
 */
function GithubIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3 w-3 opacity-70"
    >
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
        0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01
        1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
        0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.03
        2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65
        3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}

/**
 * Classification des enregistrements.
 */
function getRecordType(it: NowItem): string {
  // 1) Priorité à la valeur venant de l’API
  const raw = it.recordType;
  if (typeof raw === 'string' && raw.trim()) {
    const v = raw.trim();
    const lower = v.toLowerCase();

    if (lower === 'on-chain (firestore)') return 'On-chain (firestore)';
    if (lower === 'on-chain (publisher)') return 'On-chain (publisher)';

    // ex: on-chain (firestore:batches_v2)
    if (lower.startsWith('on-chain (firestore:')) {
      return 'On-chain (firestore)';
    }

    return v;
  }

  // 2) Logique RWA existante
  if (it.rwa_kind) {
    const rk = it.rwa_kind.toLowerCase();
    if (rk === 'sensor_batch') return 'Sensor batch (field)';
    if (rk === 'coop_delivery') return 'Coop delivery';
    return `RWA: ${rk}`;
  }

  if (it.cid === 'QmPLACEHOLDER') return 'RWA template';
  if ((it.source || '').toLowerCase() === 'simulated') return 'Simulated RWA';
  if ((it.source || '').toLowerCase() === 'ingest') return 'Ingest batch';

  // 3) Heuristique legacy en dernier
  if (it.tx && it.tx.length > 0) return 'On-chain (publisher)';

  return 'Unknown';
}


function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
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

  const ps: PointsSummary = data.pointsSummary || {
    totalPoints: 0,
    externalPoints: 0,
    externalPct: 0,
    byTeam: {},
    bySource: {},
  };

  const teamEntries = useMemo(
    () => Object.entries(ps.byTeam || {}).sort((a, b) => b[1] - a[1]),
    [ps.byTeam],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter((it) => {
      return (
        it.cid?.toLowerCase().includes(q) ||
        it.tx?.toLowerCase().includes(q) ||
        it.file?.toLowerCase().includes(q) ||
        (it.source || '').toLowerCase().includes(q) ||
        (it.team || '').toLowerCase().includes(q)
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
          placeholder="Search CID, tx, file, source, team..."
        />
        <RefreshButton label="Refresh" auto intervalMs={15000} />
      </div>

      {/* 1) cartes de base (fichiers / CIDs / on-chain / last batch) */}
      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="text-xs text-white/50 mb-1">Files</div>
          <div className="text-2xl font-semibold text-emerald-300">
            {formatNumber(data.totals.files)}
          </div>
          <div className="text-[10px] text-white/30 mt-1">Total JSON batches</div>
        </div>
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="text-xs text-white/50 mb-1">Unique CIDs</div>
          <div className="text-2xl font-semibold text-emerald-300">
            {formatNumber(data.totals.cids)}
          </div>
          <div className="text-[10px] text-white/30 mt-1">
            IPFS gateway: {new URL(ipfsGateway).host}
          </div>
        </div>
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="text-xs text-white/50 mb-1">On-chain (Devnet)</div>
          <div className="text-2xl font-semibold text-emerald-300">
            {formatNumber(data.totals.onchainTx)}
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

      {/* 2) nouvelles cartes Points / % external / Teams */}
      <div className="mb-6 grid gap-4 md:grid-cols-[1.4fr,1.4fr,1.2fr]">
        <div className="rounded-xl bg-[#0F1116] border border-emerald-500/30 p-4 shadow-md shadow-emerald-500/10">
          <div className="text-xs text-emerald-200 mb-1 uppercase tracking-wide">
            Total points
          </div>
          <div className="text-3xl font-semibold text-emerald-300">
            {formatNumber(ps.totalPoints)}
          </div>
          <div className="text-[11px] text-white/40 mt-1">
            Sum of all sensor and coop events counted by the Oracle.
          </div>
        </div>

        <div className="rounded-xl bg-[#0F1116] border border-cyan-400/30 p-4 shadow-md shadow-cyan-500/10">
          <div className="text-xs text-cyan-200 mb-1 uppercase tracking-wide">
            External points
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-cyan-300">
              {formatNumber(ps.externalPoints)}
            </span>
            <span className="text-sm text-cyan-200">
              ({ps.externalPct.toFixed(2)}%)
            </span>
          </div>
          <div className="text-[11px] text-white/40 mt-1">
            Data contributed by external teams:{' '}
            <a
              href={TEAM_LINKS['team-techlab-cme'] || '#'}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-[#14F195]"
            >
              CME
            </a>
            {', '}
            <a
              href={TEAM_LINKS['team-makm2']}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-[#14F195]"
            >
              makm2
            </a>
            {' and '}
            <a
              href={TEAM_LINKS['team-scak-coop']}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-[#14F195]"
            >
              SCAK
            </a>
            .
          </div>
        </div>

        <div className="rounded-xl bg-[#0F1116] border border-purple-400/30 p-4 shadow-md shadow-purple-500/10">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs text-purple-200 uppercase tracking-wide">
              External teams
            </div>
            <div className="text-[10px] text-white/40">
              {teamEntries.length} teams
            </div>
          </div>
          <div className="space-y-1.5 text-[12px]">
            {teamEntries.length === 0 ? (
              <div className="text-white/40">No team data yet.</div>
            ) : (
              teamEntries.map(([teamKey, pts]) => {
                const { label, url } = getTeamMeta(teamKey);
                const pct =
                  ps.totalPoints > 0
                    ? ((pts / ps.totalPoints) * 100).toFixed(1)
                    : '0.0';
                return (
                  <div
                    key={teamKey}
                    className="flex items-center justify-between"
                  >
                    <span className="text-white/70 truncate pr-2 flex items-center gap-1">
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-[#14F195] underline decoration-dotted underline-offset-2"
                        >
                          {label}
                        </a>
                      ) : (
                        <span>{label}</span>
                      )}
                      {url && <GithubIcon />}
                    </span>
                    <span className="text-white/80 font-mono text-[11px]">
                      {formatNumber(pts)} pts
                      <span className="text-white/40"> · {pct}%</span>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* chart + small info */}
      <div className="mb-6 grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">
              Transaction Stats History
            </h2>
            <span className="text-[10px] text-white/40">last 20 batches</span>
          </div>
          <TxHistory items={data.items} />
        </div>

        <div className="space-y-4">
          {/* Sources card existante */}
          <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
            <h2 className="text-sm font-medium text-white mb-3">Sources</h2>
            <div className="space-y-2 text-sm">
              {/* ... contenu existant de la carte "Sources" ... */}
            </div>
          </div>

          {/* Nouvelle carte RWA Sample Contract */}
          <div className="rounded-xl bg-[#0F1116] border border-emerald-400/40 p-4 shadow-md shadow-emerald-500/15">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">
                RWA Sample Contract
              </h2>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                Devnet
              </span>
            </div>
            <p className="text-[11px] text-white/60 mb-2">
              Demo RWA asset state machine wired to Wakama Oracle (points,
              batches, lifecycle status, invested USDC).
            </p>
            <div className="mb-2 space-y-1 text-[11px] text-white/70">
              <div>
                Program ID:&nbsp;
                <code className="rounded bg-black/40 px-1 py-0.5 text-[10px]">
                  93eL55wjf62Pw8UPsKS8V7b9efk28UyG8C74Vif2gMNR
                </code>
              </div>
              <div>
                Upgrade authority:&nbsp;
                <code className="rounded bg-black/40 px-1 py-0.5 text-[10px]">
                  GYdgCBzz9Phzvdh8dTz9VRB8qyjVbA6GscYPKTrGBczR
                </code>
              </div>
            </div>
            <div className="mb-2 text-[11px] text-white/60">
              Available instructions:&nbsp;
              <span className="font-mono">
                initialize_asset,&nbsp;push_oracle_update,&nbsp;set_status,
                &nbsp;record_investment
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <a
                href="https://explorer.solana.com/address/93eL55wjf62Pw8UPsKS8V7b9efk28UyG8C74Vif2gMNR?cluster=devnet"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg border border-white/15 px-2 py-1 hover:bg-white/10"
              >
                View on Solana Explorer
              </a>
              <a
                href="https://github.com/Wakama-Edge-Ventures/wakama-oracle-anchor"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg border border-white/15 px-2 py-1 hover:bg-white/10"
              >
                GitHub source
              </a>
              <Link
                href="/rwa-contract"
                className="inline-flex items-center rounded-lg bg-[#14F195]/15 border border-[#14F195]/40 px-2 py-1 hover:bg-[#14F195]/25"
              >
                Code source (dashboard)
              </Link>
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
                <th className="px-4 py-2.5">Team</th>
                <th className="px-4 py-2.5">Points</th>
                <th className="px-4 py-2.5">Record type</th>

              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {visible.map((it, i) => {
                const recordType = getRecordType(it);
                const toneForRecord:
                  | 'ok'
                  | 'warn'
                  | 'neutral' =
                  recordType === 'On-chain (publisher)'
                    ? 'ok'
                    : recordType === 'Coop delivery'
                    ? 'neutral'
                    : recordType === 'Sensor batch (field)'
                    ? 'neutral'
                    : recordType.includes('RWA')
                    ? 'neutral'
                    : 'warn';

                const teamMeta = getTeamMeta(it.team || '');

                return (
                  <tr
                    key={`${it.cid}-${it.tx ?? ''}-${i}`}
                    className="hover:bg-[#14F195]/5"
                  >
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
                        <span
                          title={it.file}
                          className="font-medium text-white"
                        >
                          {shorten(it.file, 20, 16)}
                        </span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {it.sha256 ? (
                        <span title={it.sha256}>
                          {shorten(it.sha256, 12, 12)}
                        </span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {it.ts ? (
                        <span className="text-white">{it.ts}</span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {(() => {
                        const s = (it.status || '').toLowerCase();
                        const tone: 'ok' | 'warn' | 'neutral' =
                          s.includes('confirmed')
                            ? 'ok'
                            : s === 'n/a'
                            ? 'neutral'
                            : 'warn';
                        return (
                          <div className="flex items-center gap-2">
                            <Badge tone={tone}>{it.status || '—'}</Badge>
                            {typeof it.slot === 'number' ? (
                              <span className="text-[11px] text-white/40">
                                slot {it.slot}
                              </span>
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
                      {it.team ? (
                        <span className="inline-flex items-center gap-1">
                          {teamMeta.url ? (
                            <a
                              href={teamMeta.url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline decoration-dotted underline-offset-2 hover:text-[#14F195]"
                            >
                              {teamMeta.label}
                            </a>
                          ) : (
                            <span>{teamMeta.label}</span>
                          )}
                          {teamMeta.url && <GithubIcon />}
                        </span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
<td className="px-4 py-2.5">
  {typeof it.count === 'number' ? (
    <span className="font-mono text-white/90">{formatNumber(it.count)}</span>
  ) : typeof it.points === 'number' ? (
    <span className="font-mono text-white/90">{formatNumber(it.points)}</span>
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
        <Link
          href="/"
          className="rounded-lg border border-white/15 px-2 py-1 hover:bg-[#14F195]/15 transition-colors"
        >
          Home
        </Link>
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


