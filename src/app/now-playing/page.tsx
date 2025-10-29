import RefreshButton from '@/components/RefreshButton';

import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// -------- Types --------
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

const EMPTY: Now = { totals: { files: 0, cids: 0, onchainTx: 0, lastTs: '—' }, items: [] };

// -------- Helpers (SSR-safe) --------
const GW_RAW =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY?.replace(/\/+$/, '') ||
  'https://gateway.pinata.cloud/ipfs';

const GW_HOST = safeHost(GW_RAW);
const GW = GW_HOST ? GW_RAW : 'https://gateway.pinata.cloud/ipfs';

// hard lock to devnet for milestone phase
const EXPLORER = 'https://explorer.solana.com/tx';
const CLUSTER = 'devnet';

const fmt = new Intl.NumberFormat('en-US');

function safeHost(u: string) {
  try {
    return new URL(u).host;
  } catch {
    return '';
  }
}

function shorten(s = '', head = 10, tail = 8) {
  if (!s || s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function linkIpfs(cid: string) {
  return `${GW}/${cid}`;
}

function linkTx(tx: string) {
  return `${EXPLORER}/${tx}?cluster=${CLUSTER}`;
}

// -------- Fallback: read snapshot from disk --------
async function readNowFromDisk(): Promise<Now> {
  try {
    const p = path.join(process.cwd(), 'public', 'now.json');
    const raw = await fs.readFile(p, 'utf-8');
    const parsed: Now = JSON.parse(raw);
    parsed.items = [...(parsed.items || [])].sort((a, b) =>
      String(b.ts || '').localeCompare(String(a.ts || ''))
    );
    return parsed;
  } catch {
    return EMPTY;
  }
}

// -------- Data fetch (Server) --------
async function fetchNow(): Promise<Now> {
  try {
    // Lire le snapshot directement depuis /public (prod & local)
    const res = await fetch('/now.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed: Now = await res.json();

    parsed.items = [...(parsed.items || [])].sort((a, b) =>
      String(b.ts || '').localeCompare(String(a.ts || ''))
    );

    if (!parsed.items || parsed.items.length === 0) {
      // fallback disque (utile en dev si pas de serveur HTTP)
      return await readNowFromDisk();
    }
    return parsed;
  } catch {
    return await readNowFromDisk();
  }
}



// --- Badge (UI) ---
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
    ok: 'bg-emerald-400/20 text-emerald-200 border-emerald-400/30',
    warn: 'bg-yellow-400/20 text-yellow-200 border-yellow-400/30',
    neutral: 'bg-white/10 text-white/80 border-white/20',
  };
  const cls = map[tone] || map.neutral;
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ${cls}`}
    >
      {children}
    </span>
  );
}

// -------- UI bits --------
function KPICard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 shadow-sm backdrop-blur-md">
      <div className="text-[10px] tracking-widest text-white/60">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">
        {typeof value === 'number' ? fmt.format(value) : value}
      </div>
      {sub ? <div className="mt-0.5 text-[11px] text-white/60">{sub}</div> : null}
    </div>
  );
}

export default async function Page() {
  const now = await fetchNow();
  const t = now.totals;

  return (
    <main className="relative mx-auto min-h-screen max-w-5xl overflow-hidden px-6 py-8 text-white">
      {/* --- Background gradient Solana --- */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A0B1A] via-[#1b0937] to-[#0a2a1f]" />
        <div className="absolute -top-24 -left-40 h-80 w-[38rem] rotate-12 rounded-full bg-gradient-to-tr from-[#9945FF] via-[#39D0D8] to-[#14F195] blur-3xl opacity-25" />
        <div className="absolute bottom-[-8rem] right-[-8rem] h-96 w-[42rem] -rotate-6 rounded-full bg-gradient-to-tr from-[#14F195] via-[#39D0D8] to-[#9945FF] blur-3xl opacity-20" />
      </div>

      {/* Top bar */}
      <header className="mb-8 flex items-center justify-between">
        <nav className="flex items-center gap-6">
          <a href="/" className="text-lg font-semibold hover:text-[#14F195] transition-colors">
            · Wakama Oracle
          </a>
          <RefreshButton label="Refresh" auto={true} intervalMs={15000} />
          <a
            href="/"
            className="rounded-lg px-3 py-1.5 text-sm text-white/70 hover:bg-[#14F195]/10 transition-colors"
          >
            Home
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-white/60 sm:inline">
            GW:&nbsp;
            <code className="rounded bg-white/10 px-1 py-0.5">
              {GW_HOST || 'gateway.pinata.cloud'}
            </code>
          </span>
          <a
            href="/now-playing"
            className="rounded-xl border border-white/15 px-3 py-1.5 text-sm hover:bg-[#14F195]/15 transition-colors"
          >
            Refresh
          </a>
        </div>
      </header>

      {/* Title */}
      <h1 className="mb-5 text-xl font-semibold tracking-tight">Now Playing</h1>

      {/* KPIs */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KPICard label="FILES" value={t.files} />
        <KPICard label="CIDs" value={t.cids} />
        <KPICard label="ON-CHAIN TX" value={t.onchainTx} />
        <KPICard label="LAST BATCH" value={t.lastTs || '—'} />
      </section>

      {/* Table */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-base font-medium">Latest items</h2>
          <div className="text-[11px] text-white/60">Showing up to: 50</div>
        </div>

        {now.items.length === 0 ? (
          <div className="rounded-2xl border border-white/15 bg-white/5 p-8 text-center text-sm text-white/70 backdrop-blur-md">
            None.
          </div>
        ) : (
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
                {now.items.slice(0, 50).map((it, i) => (
                  <tr key={`${it.cid}-${it.tx ?? ''}-${i}`} className="hover:bg-[#14F195]/10 transition-colors">
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
                      {it.ts ? <span className="text-white">{it.ts}</span> : <span className="text-white/50">—</span>}
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
                              <span className="text-[11px] text-white/60">slot {it.slot}</span>
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
                        <span className="text-white/50">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-10 flex items-center justify-between border-t border-white/10 pt-6 text-[11px] text-white/70">
        <span>© {new Date().getUTCFullYear()} Wakama.farm supported by Solana Foundation</span>
        <a href="/" className="rounded-lg border border-white/15 px-2 py-1 hover:bg-[#14F195]/15 transition-colors">
          Home
        </a>
      </footer>
    </main>
  );
}
