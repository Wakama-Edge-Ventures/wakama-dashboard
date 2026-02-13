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

  // Optionnel (si ton API/receipts les ajoute plus tard)
  battery?: number; // 0..100
  rssi?: number; // ex: -45
  deviceIdHash?: string;
  feeLamports?: number;
};

type Now = { totals: Totals; items: NowItem[]; pointsSummary?: PointsSummary };

function shorten(s = '', head = 10, tail = 8) {
  if (!s || s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

// format numérique stable
const formatNumber = (n: number) => n.toLocaleString('en-US');

type TeamType = 'core' | 'coop' | 'university' | 'partner' | 'internal' | 'other';
type TeamCatalogItem = { id: string; name: string; type: TeamType; url?: string; external: boolean };

// Aliases legacy -> canonical
const TEAM_ALIASES: Record<string, string> = {
  'Wakama Core': 'Wakama_team',
  team_wakama: 'Wakama_team',
};

// Catalogue canonique (adapte si besoin)
const TEAM_CATALOG: TeamCatalogItem[] = [
  { id: 'Wakama_team', name: 'Wakama Team', type: 'core', url: 'https://github.com/Wakama-Edge-Ventures', external: false },
  { id: 'team_etra', name: 'ETRA Coop', type: 'coop', url: '', external: true },
  { id: 'team_mks', name: 'MKS Team', type: 'partner', url: '', external: true },

  // (Tu peux garder les autres teams historiques si tu veux)
  { id: 'team-capn', name: 'CAPN – Coopérative Agricole de Petit Nando', type: 'coop', url: 'https://github.com/capn-ci', external: true },
  { id: 'team-ujlog', name: 'Université Jean Lorougnon Guédé (UJLoG)', type: 'university', url: 'https://github.com/ujlog-ci', external: true },
  { id: 'team-scak-coop', name: 'SCAK Cooperative', type: 'coop', url: 'https://github.com/SCAK-COOP-CA', external: true },
  { id: 'team-techlab-cme', name: 'TechLab CME', type: 'university', url: 'https://github.com/Techlab-cme-bingerville', external: true },
  { id: 'team-makm2', name: 'MAKM2 Partner', type: 'partner', url: 'https://github.com/makm2', external: true },
];

const TEAM_META_BY_KEY: Map<string, TeamCatalogItem> = (() => {
  const m = new Map<string, TeamCatalogItem>();
  for (const t of TEAM_CATALOG) {
    if (t.id) m.set(t.id, t);
    if (t.name) m.set(t.name, t);
  }
  return m;
})();

function normalizeTeamKey(teamKey?: string) {
  const raw = (teamKey || '').trim();
  if (!raw) return '';
  return TEAM_ALIASES[raw] || raw;
}

function getTeamMeta(teamKey: string) {
  const raw = (teamKey || '').trim();
  if (!raw) return { label: '—', url: '', type: 'other' as TeamType, external: false, canonicalId: '' };

  const normalized = normalizeTeamKey(raw);
  const t = TEAM_META_BY_KEY.get(normalized) || TEAM_META_BY_KEY.get(raw);

  if (t) {
    return {
      label: t.name || t.id,
      url: t.url || '',
      type: (t.type || 'other') as TeamType,
      external: !!t.external,
      canonicalId: t.id,
    };
  }

  return { label: raw, url: '', type: 'other' as TeamType, external: true, canonicalId: normalized || raw };
}

function TeamTypeBadge({ type }: { type: TeamType | string }) {
  const t = (type || 'other').toString().toLowerCase();

  const label =
    t === 'coop' ? 'Coop' :
    t === 'university' ? 'University' :
    t === 'partner' ? 'Partner' :
    t === 'core' ? 'Core' :
    t === 'internal' ? 'Internal' : 'Other';

  const base = 'ml-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wide';

  const cls =
    t === 'coop' ? 'border-emerald-400/40 text-emerald-200 bg-emerald-500/10' :
    t === 'university' ? 'border-sky-400/40 text-sky-200 bg-sky-500/10' :
    t === 'partner' ? 'border-amber-400/40 text-amber-200 bg-amber-500/10' :
    t === 'core' || t === 'internal' ? 'border-purple-400/40 text-purple-200 bg-purple-500/10' :
    'border-white/20 text-white/60 bg-white/5';

  return <span className={`${base} ${cls}`}>{label}</span>;
}

function GithubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 opacity-70">
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

function getRecordType(it: NowItem): string {
  const raw = it.recordType;
  if (typeof raw === 'string' && raw.trim()) {
    const v = raw.trim();
    const lower = v.toLowerCase();
    if (lower === 'on-chain (firestore)') return 'On-chain (firestore)';
    if (lower === 'on-chain (publisher)') return 'On-chain (publisher)';
    if (lower.startsWith('on-chain (firestore:')) return 'On-chain (firestore)';
    return v;
  }

  if (it.rwa_kind) {
    const rk = it.rwa_kind.toLowerCase();
    if (rk === 'sensor_batch') return 'Sensor batch (field)';
    if (rk === 'coop_delivery') return 'Coop delivery';
    return `RWA: ${rk}`;
  }

  if ((it.source || '').toLowerCase() === 'simulated') return 'Simulated';
  if ((it.source || '').toLowerCase() === 'ingest') return 'Ingest batch';
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
    <span title={title} className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ${cls}`}>
      {children}
    </span>
  );
}

function PulseDot({ tone = 'emerald' }: { tone?: 'emerald' | 'cyan' | 'fuchsia' | 'amber' }) {
  const cls =
    tone === 'cyan'
      ? 'bg-cyan-300 shadow-cyan-300/40'
      : tone === 'fuchsia'
      ? 'bg-fuchsia-300 shadow-fuchsia-300/40'
      : tone === 'amber'
      ? 'bg-amber-300 shadow-amber-300/40'
      : 'bg-emerald-300 shadow-emerald-300/40';

  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${cls}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full shadow ${cls}`} />
    </span>
  );
}

function useAnimatedNumber(target: number, ms = 900) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const from = val;
    const to = Number.isFinite(target) ? target : 0;

    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return val;
}

// Carte Afrique de l’Ouest (SVG simple + points clignotants + clic = filtre team)
function WestAfricaMap({
  onSelectTeam,
  selectedTeam,
}: {
  onSelectTeam: (teamId: string) => void;
  selectedTeam?: string;
}) {
  const pins = [
    { id: 'team_mks', label: 'MKS', x: 210, y: 170, tone: 'cyan' as const },
    { id: 'team_etra', label: 'ETRA', x: 255, y: 190, tone: 'emerald' as const },
    { id: 'Wakama_team', label: 'Wakama', x: 235, y: 155, tone: 'fuchsia' as const },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">West Africa DePIN</span>
          <Badge tone="ok" title="This view is for Mainnet pipeline monitoring">
            <span className="flex items-center gap-2">
              <PulseDot tone="emerald" />
              Mainnet Verified
            </span>
          </Badge>
        </div>
        <div className="text-[11px] text-white/50">
          Click a node to filter the table
        </div>
      </div>

      <div className="relative">
        {/* “military tech” grid overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:18px_18px]" />

        <svg viewBox="0 0 520 260" className="w-full">
          {/* stylized coastline/blob (not geographic-accurate; juste visuel) */}
          <defs>
            <linearGradient id="sol" x1="0" x2="1">
              <stop offset="0" stopColor="#9945FF" stopOpacity="0.45" />
              <stop offset="0.55" stopColor="#39D0D8" stopOpacity="0.35" />
              <stop offset="1" stopColor="#14F195" stopOpacity="0.35" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            d="M70,60 C120,20 210,30 250,55 C290,80 320,65 360,70 C400,75 450,110 455,145
               C460,180 420,215 360,225 C300,235 260,210 220,215 C180,220 150,235 115,215
               C80,195 55,150 60,110 C65,80 55,75 70,60 Z"
            fill="url(#sol)"
            stroke="rgba(255,255,255,0.14)"
          />

          {/* targeting lines */}
          <line x1="0" y1="130" x2="520" y2="130" stroke="rgba(255,255,255,0.07)" />
          <line x1="260" y1="0" x2="260" y2="260" stroke="rgba(255,255,255,0.07)" />

          {pins.map((p) => {
            const active = (selectedTeam || '') === p.id;
            const tone =
              p.tone === 'cyan'
                ? 'rgba(56, 189, 248, 0.9)'
                : p.tone === 'fuchsia'
                ? 'rgba(232, 121, 249, 0.9)'
                : 'rgba(52, 211, 153, 0.9)';

            return (
              <g
                key={p.id}
                onClick={() => onSelectTeam(p.id)}
                style={{ cursor: 'pointer' }}
                filter="url(#glow)"
              >
                <circle cx={p.x} cy={p.y} r={active ? 10 : 8} fill={tone} opacity="0.95" />
                <circle cx={p.x} cy={p.y} r={active ? 22 : 18} fill={tone} opacity="0.12">
                  <animate attributeName="r" values={`${active ? 22 : 18};${active ? 34 : 28};${active ? 22 : 18}`} dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.20;0.02;0.20" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <text x={p.x + 14} y={p.y + 4} fontSize="12" fill="rgba(255,255,255,0.85)">
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60">
        <button
          type="button"
          onClick={() => onSelectTeam('')}
          className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 hover:bg-white/10"
        >
          Clear filter
        </button>
        <span className="rounded-lg border border-white/10 bg-black/10 px-2 py-1">
          Status: <span className="text-emerald-200">LIVE telemetry</span>
        </span>
        <span className="rounded-lg border border-white/10 bg-black/10 px-2 py-1">
          Mode: <span className="text-white/80">Mainnet pipeline</span>
        </span>
      </div>
    </div>
  );
}

function TinyBars({ title, data }: { title: string; data: Array<{ k: string; v: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/70">{title}</div>
        <span className="text-[11px] text-white/40">live</span>
      </div>
      <div className="space-y-2">
        {data.slice(0, 6).map((d) => (
          <div key={d.k} className="flex items-center gap-2">
            <div className="w-28 truncate text-[11px] text-white/65">{d.k}</div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-[#9945FF] via-[#39D0D8] to-[#14F195]"
                style={{ width: `${Math.round((d.v / max) * 100)}%` }}
              />
            </div>
            <div className="w-16 text-right font-mono text-[11px] text-white/70">{formatNumber(d.v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NowPlayingMainnetClient({
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
  const [teamFilter, setTeamFilter] = useState<string>('');

  // Back to top
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

  const animatedTotal = useAnimatedNumber(ps.totalPoints || 0, 950);
  const animatedExternal = useAnimatedNumber(ps.externalPoints || 0, 950);

  // Merge teams by canonical key
  const teamEntries = useMemo(() => {
    const acc = new Map<string, number>();
    for (const [rawKey, pts] of Object.entries(ps.byTeam || {})) {
      const canonical = normalizeTeamKey(rawKey) || rawKey;
      acc.set(canonical, (acc.get(canonical) || 0) + (pts || 0));
    }
    return Array.from(acc.entries()).sort((a, b) => b[1] - a[1]);
  }, [ps.byTeam]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = data.items || [];

    // team filter from map
    if (teamFilter) {
      items = items.filter((it) => normalizeTeamKey(it.team || '') === teamFilter);
    }

    if (!q) return items;

    return items.filter((it) => {
      return (
        it.cid?.toLowerCase().includes(q) ||
        it.tx?.toLowerCase().includes(q) ||
        it.file?.toLowerCase().includes(q) ||
        (it.source || '').toLowerCase().includes(q) ||
        (it.team || '').toLowerCase().includes(q)
      );
    });
  }, [data.items, query, teamFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);

  // KPI “live telemetry” (best-effort)
  const telemetryKpi = useMemo(() => {
    const items = data.items || [];
    let batterySum = 0, batteryN = 0;
    let rssiSum = 0, rssiN = 0;
    let feeSumLamports = 0, feeN = 0;
    let devices = new Set<string>();

    for (const it of items) {
      const anyIt = it as any;
      if (typeof anyIt.battery === 'number') { batterySum += anyIt.battery; batteryN++; }
      if (typeof anyIt.rssi === 'number') { rssiSum += anyIt.rssi; rssiN++; }
      if (typeof anyIt.feeLamports === 'number') { feeSumLamports += anyIt.feeLamports; feeN++; }
      if (typeof anyIt.deviceIdHash === 'string' && anyIt.deviceIdHash.trim()) devices.add(anyIt.deviceIdHash.trim());
    }

    return {
      avgBattery: batteryN ? Math.round(batterySum / batteryN) : null,
      avgRssi: rssiN ? Math.round(rssiSum / rssiN) : null,
      devicesCount: devices.size || null,
      avgFeeLamports: feeN ? Math.round(feeSumLamports / feeN) : null,
    };
  }, [data.items]);

  // Charts data
  const bySourceBars = useMemo(() => {
    const entries = Object.entries(ps.bySource || {}).map(([k, v]) => ({ k, v: Number(v || 0) }));
    entries.sort((a, b) => b.v - a.v);
    return entries;
  }, [ps.bySource]);

  const externalTarget = 80; // gros indicateur demandé
  const externalNow = Number.isFinite(ps.externalPct) ? ps.externalPct : 0;
  const externalOk = externalNow >= externalTarget;

  function applyTeamFilter(teamId: string) {
    setTeamFilter(teamId);
    setPage(1);
  }

  return (
    <>
      {/* Global “military tech” background glow + scanline */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 -top-8 h-24 bg-gradient-to-b from-white/5 to-transparent" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background:repeating-linear-gradient(180deg,rgba(255,255,255,0.18)_0px,rgba(255,255,255,0.18)_1px,transparent_1px,transparent_6px)]" />
      </div>

      {/* top bar */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SearchBar
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          items={data.items}
          placeholder="Search CID, tx, file, source, team..."
        />
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white/70">
            <span className="mr-2 inline-flex items-center gap-2">
              <PulseDot tone={externalOk ? 'emerald' : 'amber'} />
              External share
            </span>
            <span className={`font-semibold ${externalOk ? 'text-emerald-200' : 'text-amber-200'}`}>
              {externalNow.toFixed(2)}%
            </span>
            <span className="text-white/40"> / target </span>
            <span className="text-white/80 font-semibold">{externalTarget}%</span>
          </span>
          <RefreshButton label="Refresh" auto intervalMs={15000} />
        </div>
      </div>

      {/* HERO KPIs */}
      <div className="mb-6 grid gap-4 md:grid-cols-[1.3fr,1fr,1fr]">
        <div className="rounded-2xl border border-emerald-500/30 bg-[#0F1116] p-5 shadow-[0_0_40px_rgba(20,241,149,0.10)]">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Mainnet Points</div>
            <Badge tone="ok" title="Mainnet verified view">
              <span className="flex items-center gap-2"><PulseDot tone="emerald" /> Mainnet Verified</span>
            </Badge>
          </div>
          <div className="text-4xl font-semibold text-emerald-300">{formatNumber(animatedTotal)}</div>
          <div className="mt-2 text-[11px] text-white/50">
            Live counter from oracle receipts / batches (1 point = 1 métrique).
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/70">
              Last batch: <span className="text-white/90">{data.totals.lastTs || '—'}</span>
            </span>
            <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/70">
              Cluster: <span className="text-white/90">{cluster}</span>
            </span>
            <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/70">
              Gateway: <span className="text-white/90">{new URL(ipfsGateway).host}</span>
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-400/25 bg-[#0F1116] p-5 shadow-[0_0_40px_rgba(56,189,248,0.08)]">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-200">External Points</div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold text-cyan-300">{formatNumber(animatedExternal)}</span>
            <span className="text-sm text-cyan-200">({externalNow.toFixed(2)}%)</span>
          </div>
          <div className="mt-2 text-[11px] text-white/50">
            Required by Solana Foundation: keep external share dominant.
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] text-white/60 mb-1">Big indicator</div>
            <div className={`text-3xl font-bold tracking-tight ${externalOk ? 'text-emerald-200' : 'text-amber-200'}`}>
              {externalTarget}% EXTERNAL
            </div>
            <div className="text-[11px] text-white/50 mt-1">
              Current: <span className="text-white/80 font-semibold">{externalNow.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-fuchsia-400/25 bg-[#0F1116] p-5 shadow-[0_0_40px_rgba(232,121,249,0.08)]">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fuchsia-200">Live Telemetry</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[10px] text-white/50">Avg Battery</div>
              <div className="text-lg font-semibold text-white">
                {telemetryKpi.avgBattery === null ? '—' : `${telemetryKpi.avgBattery}%`}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[10px] text-white/50">Avg RSSI</div>
              <div className="text-lg font-semibold text-white">
                {telemetryKpi.avgRssi === null ? '—' : telemetryKpi.avgRssi}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[10px] text-white/50">Devices</div>
              <div className="text-lg font-semibold text-white">
                {telemetryKpi.devicesCount === null ? '—' : telemetryKpi.devicesCount}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[10px] text-white/50">Avg Fee (lamports)</div>
              <div className="text-lg font-semibold text-white">
                {telemetryKpi.avgFeeLamports === null ? '—' : formatNumber(telemetryKpi.avgFeeLamports)}
              </div>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-white/50">
            (Battery/RSSI/Fee/DeviceID appear when your receipts/API includes them.)
          </div>
        </div>
      </div>

      {/* Map + Charts */}
      <div className="mb-6 grid gap-4 md:grid-cols-[1.6fr,1fr]">
        <WestAfricaMap
          selectedTeam={teamFilter}
          onSelectTeam={(id) => {
            applyTeamFilter(id);
            if (!id) setQuery('');
            else setQuery(getTeamMeta(id).label);
          }}
        />

        <div className="space-y-4">
          <TinyBars title="Points by source" data={bySourceBars} />
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/70">Teams (live)</div>
              <span className="text-[11px] text-white/40">{teamEntries.length} teams</span>
            </div>
            <div className="space-y-1.5 text-[12px]">
              {teamEntries.length === 0 ? (
                <div className="text-white/40">No team data yet.</div>
              ) : (
                teamEntries.slice(0, 8).map(([teamKey, pts]) => {
                  const meta = getTeamMeta(teamKey);
                  const pct = ps.totalPoints > 0 ? ((pts / ps.totalPoints) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={teamKey} className="flex items-center justify-between">
                      <span className="text-white/70 truncate pr-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => applyTeamFilter(meta.canonicalId || teamKey)}
                          className="hover:text-[#14F195] underline decoration-dotted underline-offset-2"
                          title="Filter by this team"
                        >
                          {meta.label}
                        </button>
                        <TeamTypeBadge type={meta.type} />
                        {meta.external ? (
                          <span className="ml-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-emerald-200">
                            External
                          </span>
                        ) : (
                          <span className="ml-1 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-fuchsia-200">
                            Internal
                          </span>
                        )}
                      </span>
                      <span className="text-white/80 font-mono text-[11px]">
                        {formatNumber(pts)} pts <span className="text-white/40">· {pct}%</span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setTeamFilter(''); setQuery(''); setPage(1); }}
                className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10"
              >
                Clear filters
              </button>
              <span className="rounded-lg border border-white/10 bg-black/10 px-2 py-1 text-[11px] text-white/60">
                Filter: <span className="text-white/80">{teamFilter || '—'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 1) cartes de base */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="text-xs text-white/50 mb-1">Files</div>
          <div className="text-2xl font-semibold text-emerald-300">{formatNumber(data.totals.files)}</div>
          <div className="text-[10px] text-white/30 mt-1">Total JSON batches</div>
        </div>
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="text-xs text-white/50 mb-1">Unique CIDs</div>
          <div className="text-2xl font-semibold text-emerald-300">{formatNumber(data.totals.cids)}</div>
          <div className="text-[10px] text-white/30 mt-1">IPFS gateway: {new URL(ipfsGateway).host}</div>
        </div>
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="text-xs text-white/50 mb-1">On-chain (Mainnet)</div>
          <div className="text-2xl font-semibold text-emerald-300">{formatNumber(data.totals.onchainTx)}</div>
          <div className="text-[10px] text-white/30 mt-1">Explorer cluster: {cluster}</div>
        </div>
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="text-xs text-white/50 mb-1">Last batch</div>
          <div className="text-sm font-medium text-white">{data.totals.lastTs || '—'}</div>
          <div className="text-[10px] text-emerald-300 mt-1">Live</div>
        </div>
      </div>

      {/* chart + info */}
      <div className="mb-6 grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">Transaction Stats History</h2>
            <span className="text-[10px] text-white/40">last 20 batches</span>
          </div>
          <TxHistory items={data.items} />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-[#0F1116] border border-white/5 p-4">
            <h2 className="text-sm font-medium text-white mb-3">Sources</h2>
            <div className="space-y-2 text-[11px] text-white/60">
              <div className="flex items-center justify-between">
                <span>Gateway</span>
                <span className="font-mono text-white/75">{new URL(ipfsGateway).host}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Explorer base</span>
                <span className="font-mono text-white/75">{new URL(explorerBase).host}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cluster</span>
                <span className="font-mono text-white/75">{cluster}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#0F1116] border border-emerald-400/40 p-4 shadow-md shadow-emerald-500/15">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">RWA Sample Contract</h2>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">Devnet</span>
            </div>
            <p className="text-[11px] text-white/60 mb-2">
              Demo RWA asset state machine wired to Wakama Oracle.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <a
                href="https://github.com/Wakama-Edge-Ventures/wakama-oracle-anchor"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-2 py-1 hover:bg-white/10"
              >
                <GithubIcon /> GitHub source
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
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                className="rounded bg-[#0A0B1A] border border-white/10 px-1.5 py-0.5 text-[11px]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <span>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
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
                const toneForRecord: 'ok' | 'warn' | 'neutral' =
                  recordType === 'On-chain (publisher)' ? 'ok' :
                  recordType.includes('RWA') ? 'neutral' :
                  recordType === 'Coop delivery' ? 'neutral' :
                  recordType === 'Sensor batch (field)' ? 'neutral' : 'warn';

                const teamMeta = getTeamMeta(it.team || '');

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
                        <span title={it.file} className="font-medium text-white">{shorten(it.file, 20, 16)}</span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {it.sha256 ? <span title={it.sha256}>{shorten(it.sha256, 12, 12)}</span> : <span className="text-white/40">—</span>}
                    </td>
                    <td className="px-4 py-2.5">{it.ts ? <span className="text-white">{it.ts}</span> : <span className="text-white/40">—</span>}</td>
                    <td className="px-4 py-2.5">
                      {(() => {
                        const s = (it.status || '').toLowerCase();
                        const tone: 'ok' | 'warn' | 'neutral' =
                          s.includes('confirmed') ? 'ok' : s === 'n/a' ? 'neutral' : 'warn';
                        return (
                          <div className="flex items-center gap-2">
                            <Badge tone={tone}>{it.status || '—'}</Badge>
                            {typeof it.slot === 'number' ? <span className="text-[11px] text-white/40">slot {it.slot}</span> : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2.5">{it.source ? <Badge tone="neutral" title="Receipt source">{it.source}</Badge> : <span className="text-white/40">—</span>}</td>
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
                          <TeamTypeBadge type={teamMeta.type} />
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
                      <Badge tone={toneForRecord} title="Classified by dashboard">{recordType}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="mt-4 flex items-center justify-between text-[11px] text-white/50">
          <div>Page {pageClamped} / {totalPages}</div>
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
          <a href="https://wakama.farm" target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-4 hover:text-[#14F195]">
            Wakama.farm
          </a>{' '}
          supported by{' '}
          <a href="https://solana.org" target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-4 hover:text-[#14F195]">
            Solana Foundation
          </a>
        </span>
        <Link href="/" className="rounded-lg border border-white/15 px-2 py-1 hover:bg-[#14F195]/15 transition-colors">
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