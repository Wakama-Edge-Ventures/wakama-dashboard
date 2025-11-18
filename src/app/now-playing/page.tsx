// src/app/now-playing/page.tsx
import { promises as fs } from 'fs';
import path from 'path';
import NowPlayingClient from '@/components/NowPlayingClient';

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
  team?: string;     // équipe qui a généré le batch
  count?: number;    // nombre de points dans ce batch
};
export type Now = { totals: Totals; items: NowItem[] };

const EMPTY: Now = {
  totals: { files: 0, cids: 0, onchainTx: 0, lastTs: '—' },
  items: [],
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
  const base = (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );
  // on lit le snapshot généré par le publisher
  const url = `${base}/now.json`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const parsed: Now = await res.json();
    parsed.items = [...(parsed.items || [])].sort((a, b) =>
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

export default async function Page() {
  const now = await fetchNow();
  const year = new Date().getUTCFullYear();

  return (
    <main className="relative mx-auto min-h-screen max-w-6xl overflow-hidden px-6 py-8 text-white">
      {/* --- Background gradient Solana --- */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#0A0B1A]" />
        <div className="absolute -top-24 -left-40 h-80 w-[38rem] rotate-12 rounded-full bg-gradient-to-tr from-[#9945FF] via-[#39D0D8] to-[#14F195] blur-3xl opacity-20" />
        <div className="absolute bottom-[-8rem] right-[-8rem] h-96 w-[42rem] -rotate-6 rounded-full bg-gradient-to-tr from-[#14F195] via-[#39D0D8] to-[#9945FF] blur-3xl opacity-15" />
      </div>

      {/* Top bar */}
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <a
            href="/"
            className="text-lg font-semibold tracking-tight hover:text-[#14F195] transition-colors"
          >
            · Wakama Oracle
          </a>
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
