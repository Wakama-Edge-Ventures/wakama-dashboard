// src/app/api/now-mainnet-v2/route.ts

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================
   TYPES
========================= */

type Totals = {
  files: number;
  cids: number;
  onchainTx: number;
  lastTs: string;
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
  recordType?: string;
  count?: number;
  points?: number;
};

type Targets = {
  requiredTotalPoints: number;
  requiredInternalPct: number;
  requiredExternalPct: number;
  requiredExternalTeamMinPoints: number;
};

type TeamProgress = {
  points: number;
  requiredMinPoints: number;
  progressPct: number;
  met: boolean;
};

type PointsSummary = {
  totalPoints: number;
  externalPoints: number;
  externalPct: number;
  byTeam: Record<string, number>;
  bySource: Record<string, number>;
  internalPoints?: number;
  internalPct?: number;
  targets?: Targets;
  progress?: {
    requiredTotalPoints: number;
    totalProgressPct: number;
    requiredInternalPoints: number;
    internalProgressPct: number;
    requiredExternalPoints: number;
    externalProgressPct: number;
  };
  byTeamProgress?: Record<string, TeamProgress>;
};

type Now = { totals: Totals; items: NowItem[]; pointsSummary?: PointsSummary };

const EMPTY: Now = {
  totals: { files: 0, cids: 0, onchainTx: 0, lastTs: "—" },
  items: [],
  pointsSummary: {
    totalPoints: 0,
    externalPoints: 0,
    externalPct: 0,
    byTeam: {},
    bySource: {},
  },
};

/* =========================
   LEGACY JSON (publisher snapshot)
========================= */

async function loadLegacyNow(): Promise<Now> {
  try {
    const filePath = path.join(process.cwd(), "public", "now_mainnet_v2.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Now;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return {
      totals: parsed?.totals ?? EMPTY.totals,
      items,
    };
  } catch {
    return {
      totals: EMPTY.totals,
      items: [],
      pointsSummary: EMPTY.pointsSummary,
    };
  }
}

/* =========================
   MAINNET FILTER
========================= */

const BLOCKED_TEAMS_EXACT = new Set<string>([
  "capn_san_pedro",
  "capn san pedro",
]);

function filterMainnetItems(items: NowItem[]) {
  return (items || []).filter((it) => {
    const t = (it.team || "").trim();
    if (!t) return true;
    return !BLOCKED_TEAMS_EXACT.has(t);
  });
}

/* =========================
   POINTS SUMMARY
========================= */

const INTERNAL_TEAM_LABELS = new Set<string>([
  "Wakama_team",
  "Wakama Team",
  "Wakama team",
]);

const REQUIRED_TOTAL_POINTS = 400_000;
const REQUIRED_INTERNAL_PCT = 20;
const REQUIRED_EXTERNAL_PCT = 80;
const REQUIRED_EXTERNAL_TEAM_MIN_POINTS = 50_000;

function safeNum(x: unknown) {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

function computePointsSummary(items: NowItem[]): PointsSummary {
  const byTeam: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalPoints = 0;

  for (const it of items) {
    const p = safeNum(it.points ?? it.count);
    totalPoints += p;
    const team = (it.team || "unknown").trim() || "unknown";
    const src = (it.source || "unknown").trim() || "unknown";
    byTeam[team] = (byTeam[team] || 0) + p;
    bySource[src] = (bySource[src] || 0) + p;
  }

  let externalPoints = 0;
  let internalPoints = 0;

  for (const [team, pts] of Object.entries(byTeam)) {
    if (INTERNAL_TEAM_LABELS.has(team)) internalPoints += pts;
    else externalPoints += pts;
  }

  const externalPct = totalPoints > 0 ? (externalPoints / totalPoints) * 100 : 0;
  const internalPct = totalPoints > 0 ? (internalPoints / totalPoints) * 100 : 0;

  const requiredInternalPoints = Math.round((REQUIRED_INTERNAL_PCT / 100) * REQUIRED_TOTAL_POINTS);
  const requiredExternalPoints = REQUIRED_TOTAL_POINTS - requiredInternalPoints;

  const totalProgressPct = REQUIRED_TOTAL_POINTS > 0 ? (totalPoints / REQUIRED_TOTAL_POINTS) * 100 : 0;
  const internalProgressPct = requiredInternalPoints > 0 ? (internalPoints / requiredInternalPoints) * 100 : 0;
  const externalProgressPct = requiredExternalPoints > 0 ? (externalPoints / requiredExternalPoints) * 100 : 0;

  const byTeamProgress: Record<string, TeamProgress> = {};
  for (const [team, pts] of Object.entries(byTeam)) {
    if (INTERNAL_TEAM_LABELS.has(team)) continue;
    const progressPct = REQUIRED_EXTERNAL_TEAM_MIN_POINTS > 0
      ? (pts / REQUIRED_EXTERNAL_TEAM_MIN_POINTS) * 100
      : 0;
    byTeamProgress[team] = {
      points: pts,
      requiredMinPoints: REQUIRED_EXTERNAL_TEAM_MIN_POINTS,
      progressPct,
      met: pts >= REQUIRED_EXTERNAL_TEAM_MIN_POINTS,
    };
  }

  return {
    totalPoints, externalPoints, externalPct, byTeam, bySource,
    internalPoints, internalPct,
    targets: {
      requiredTotalPoints: REQUIRED_TOTAL_POINTS,
      requiredInternalPct: REQUIRED_INTERNAL_PCT,
      requiredExternalPct: REQUIRED_EXTERNAL_PCT,
      requiredExternalTeamMinPoints: REQUIRED_EXTERNAL_TEAM_MIN_POINTS,
    },
    progress: {
      requiredTotalPoints: REQUIRED_TOTAL_POINTS,
      totalProgressPct,
      requiredInternalPoints,
      internalProgressPct,
      requiredExternalPoints,
      externalProgressPct,
    },
    byTeamProgress,
  };
}

/* =========================
   API HANDLER
========================= */

export async function GET() {
  try {
    const legacyRaw = await loadLegacyNow();

    // Firebase removed — use legacy snapshot only
    const items = filterMainnetItems(legacyRaw.items || []);

    const totals: Totals = {
      files: items.length,
      cids: items.filter((i) => !!i.cid).length,
      onchainTx: items.filter((i) => !!i.tx).length,
      lastTs: items[0]?.ts || legacyRaw.totals?.lastTs || "—",
    };

    const pointsSummary = computePointsSummary(items);

    return NextResponse.json(
      { totals, items, pointsSummary },
      { headers: { "cache-control": "no-store, max-age=0" } }
    );
  } catch {
    return NextResponse.json(EMPTY, {
      headers: { "cache-control": "no-store, max-age=0" },
    });
  }
}
