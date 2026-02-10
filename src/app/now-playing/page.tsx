// src/app/now-playing/page.tsx
import { promises as fs } from 'fs';
import path from 'path';
import NowPlayingClient from '@/components/NowPlayingClient';
import Link from 'next/link';

export const revalidate = 0;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// -------- Types --------
type Totals = { files: number; cids: number; onchainTx: number; lastTs: string };

export type NowItem = {
  cid: string;
  tx?: string;
  file?: string;
  sha256?: string;
  ts?: string;
  status?: string;
  slot?: number | null;
  source?: string;
  team?: string;
  recordType?: string;
  count?: number;
  points?: number;
};

type PointsSummary = {
  totalPoints: number;
  externalPoints: number;
  externalPct: number;
  byTeam: Record<string, number>;
  bySource: Record<string, number>;
};

export type Now = {
  totals: Totals;
  items: NowItem[];
  pointsSummary?: PointsSummary;
};

const EMPTY: Now = {
  totals: { files: 0, cids: 0, onchainTx: 0, lastTs: '—' },
  items: [],
  pointsSummary: {
    totalPoints: 0,
    externalPoints: 0,
    externalPct: 0,
    byTeam: {},
    bySource: {},
  },
};

// -------- Helpers (SSR-safe) --------
const GW_RAW =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY?.replace(/\/+$/, '') ||
  'https://gateway.pinata.cloud/ipfs';

function safeHost(u: string) {
  try {
    return new URL(u).host;
  } catch {
    return '';
  }
}

const GW_HOST = safeHost(GW_RAW);
const GW = GW_HOST ? GW_RAW : 'https://gateway.pinata.cloud/ipfs';

// hard lock to devnet for milestone phase
const EXPLORER = 'https://explorer.solana.com/tx';
const CLUSTER = 'devnet';

// -------- Fallback: read snapshot from disk --------
async function readNowFromDisk(): Promise<Now> {
  try {
    const p = path.join(process.cwd(), 'public', 'now.json');
    const raw = await fs.readFile(p, 'utf-8');
    const parsed: Now = JSON.parse(raw);
    parsed.items = [...(parsed.items || [])].sort((a, b) =>
      String(b.ts || '').localeCompare(String(a.ts || '')),
    );
    return parsed;
  } catch {
    return EMPTY;
  }
}

// -------- Data fetch (Server) --------
async function fetchNow(): Promise<Now> {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || 'https://rwa.wakama.farm').replace(
    /\/+$/,
    '',
  );
  const url = `${base}/api/now`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const parsed: Now = await res.json();

    // Compat M2:
    parsed.items = (parsed.items || []).map((it: NowItem) => ({
      ...it,
      count: it.count ?? it.points ?? 0,
    }));

    parsed.items = [...parsed.items].sort((a, b) =>
      String(b.ts || '').localeCompare(String(a.ts || '')),
    );

    if (!parsed.items || parsed.items.length === 0) {
      return await readNowFromDisk();
    }
    return parsed;
  } catch {
    return await readNowFromDisk();
  }
}

function RealmsBadge() {
  // Lightweight inline "logo-style" mark (no external asset needed)
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-grid h-7 w-7 place-items-center rounded-full bg-white/10 ring-1 ring-white/10">
        <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#9945FF] via-[#39D0D8] to-[#14F195] opacity-70 blur-[10px]" />
        {/* Animated green "R" to signal live governance */}
        <span
          className="relative text-[11px] font-semibold tracking-tight text-emerald-200 animate-pulse"
          title="Realms governance live"
        >
          R
        </span>
      </span>
      <span className="text-sm font-semibold tracking-tight">Realms</span>
    </span>
  );
}

export default async function Page() {
  const now = await fetchNow();
  const year = new Date().getUTCFullYear();

  return (
    <main className="relative mx-auto min-h-screen max-w-[1400px] overflow-hidden px-6 py-8 text-white">
      {/* --- Background gradient Solana --- */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#0A0B1A]" />
        <div className="absolute -top-24 -left-40 h-80 w-[38rem] rotate-12 rounded-full bg-gradient-to-tr from-[#9945FF] via-[#39D0D8] to-[#14F195] blur-3xl opacity-20" />
        <div className="absolute bottom-[-8rem] right-[-8rem] h-96 w-[42rem] -rotate-6 rounded-full bg-gradient-to-tr from-[#14F195] via-[#39D0D8] to-[#9945FF] blur-3xl opacity-15" />
      </div>

      {/* Top bar */}
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight hover:text-[#14F195] transition-colors"
          >
            · Wakama Oracle
          </Link>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/50">
          <span>
            GW:&nbsp;
            <code className="rounded bg-white/10 px-1 py-0.5 text-[10px]">
              {GW_HOST || 'gateway.pinata.cloud'}
            </code>
          </span>
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] text-emerald-200">
            Devnet locked
          </span>
        </div>
      </header>

      {/* ✅ Governance / Realms highlight (M2) */}
      <section className="mb-6">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-5">
          <div className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-gradient-to-tr from-[#9945FF] via-[#39D0D8] to-[#14F195] blur-3xl opacity-20" />
          <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-gradient-to-tr from-[#14F195] via-[#39D0D8] to-[#9945FF] blur-3xl opacity-15" />

          <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 hidden h-10 w-1.5 rounded-full bg-gradient-to-b from-[#14F195] via-[#39D0D8] to-[#9945FF] md:block" />
              <div>
                <div className="flex items-center gap-3">
                  <RealmsBadge />
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80">
                    M2 Governance
                  </span>
                </div>
                <h2 className="mt-2 text-base font-semibold tracking-tight">
                  DAO active · Oracle feeds governance enabled
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-white/60 max-w-[60ch]">
                  Governance readiness is validated through Realms to support community oversight
                  of oracle feed policies and early RWA listing rules.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://v2.realms.today/dao/8Xw1myCYCtKbZFpogf9jR3ambD6xCzaGCe9wdMfFfG9T/proposal/98G2HTdMPrXjfKFs651es28Gc4pb1a3h8RKNHQKWtNA2"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-semibold text-white/90 hover:bg-white/15 transition"
                title="Open Realms proposal: Wakama Oracle Feeds Policy v1 (M2)"
              >
                Open Realms
              </a>
              <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] text-white/60">
                Community governance layer
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Client-side interactive dashboard */}
      <NowPlayingClient
        data={now}
        explorerBase={EXPLORER}
        cluster={CLUSTER}
        ipfsGateway={GW}
        year={year}
      />
    </main>
  );
}
