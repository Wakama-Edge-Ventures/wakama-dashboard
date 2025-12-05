// src/app/api/now/route.ts

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// IMPORTANT: We keep using your existing Firebase client setup.
// This assumes you already have:
//   export const db = getFirestore(app)
// in: src/lib/firebaseClient.ts
import { db } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

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

type PointsSummary = {
  totalPoints: number;
  externalPoints: number;
  externalPct: number;
  byTeam: Record<string, number>;
  bySource: Record<string, number>;
};

// We keep Now backward compatible for M1 pages.
// pointsSummary is optional so older UI won't break if it ignores it.
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

// -------- Legacy (Milestone 1) --------

async function loadLegacyNow(): Promise<Now> {
  try {
    const filePath = path.join(process.cwd(), "public", "now.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Now;

    const legacyItems = Array.isArray(parsed?.items) ? parsed.items : [];

    // IMPORTANT:
    // We DO NOT modify the old data content.
    // We only add a default recordType label if missing
    // to avoid null groupings in the UI.
    const normalizedLegacyItems: NowItem[] = legacyItems.map((it: any) => {
      const pointsRaw =
        typeof it?.points === "number"
          ? it.points
          : typeof it?.pointsCount === "number"
          ? it.pointsCount
          : typeof it?.count === "number"
          ? it.count
          : 0;

      const pointsCount = Number.isFinite(pointsRaw) ? pointsRaw : 0;

      return {
        ...it,
        recordType: it?.recordType ?? "on-chain (publisher)",
        count:
          typeof it?.count === "number"
            ? it.count
            : pointsCount,
        points: pointsCount,
      };
    });

    return {
      totals: parsed?.totals ?? EMPTY.totals,
      items: normalizedLegacyItems,
    };
  } catch {
    return {
      totals: EMPTY.totals,
      items: [],
    };
  }
}

function toIsoFromSeconds(seconds?: number) {
  if (!seconds) return "—";
  const d = new Date(seconds * 1000);
  return d.toISOString();
}

// -------- Firestore (Milestone 2+) --------

// Try multiple possible collections to avoid a silent mismatch.
// Keep "batches" first, then common alternates.
const BATCH_COLLECTION_CANDIDATES = [
  "batches",
  "tx_iot2chain",
  "iot_batches",
  "oracle_batches",
];

async function loadTeamsMap() {
  const teamsSnap = await getDocs(collection(db, "teams"));
  const teams = teamsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  const teamNameById = new Map<string, string>();
  for (const t of teams) {
    if (t?.id) teamNameById.set(t.id, t.name || t.id);
  }
  return teamNameById;
}

async function readLatestBatchesFromCollection(collectionName: string) {
  // We try ordering by "timestamp".
  const qy = query(
    collection(db, collectionName),
    orderBy("timestamp", "desc"),
    limit(200)
  );

  const snap = await getDocs(qy);

  const docs = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  return docs;
}

async function loadFirestoreNow(): Promise<Now> {
  const teamNameById = await loadTeamsMap();

  // Find the first collection that returns data
  let batches: any[] = [];
  let usedCollection = "";

  for (const name of BATCH_COLLECTION_CANDIDATES) {
    try {
      const docs = await readLatestBatchesFromCollection(name);
      if (docs.length > 0) {
        batches = docs;
        usedCollection = name;
        break;
      }
    } catch {
      // ignore and try next
    }
  }

  if (batches.length === 0) {
    return { totals: EMPTY.totals, items: [] };
  }

  const items: NowItem[] = batches.map((b) => {
    const seconds = b?.timestamp?.seconds;

    const cid = b?.cid ?? "";
    const tx = b?.txSignature ?? undefined;

    const teamLabel = teamNameById.get(b.teamId) ?? b.teamId ?? "unknown";

    const pointsRaw =
      typeof b?.points === "number"
        ? b.points
        : typeof b?.pointsCount === "number"
        ? b.pointsCount
        : typeof b?.count === "number"
        ? b.count
        : 0;

    const pointsCount = Number.isFinite(pointsRaw) ? pointsRaw : 0;

    return {
      cid,
      tx,
      file: b.id ? `batch:${b.id}` : undefined,
      sha256: b.sha256 ?? undefined,
      ts: seconds ? toIsoFromSeconds(seconds) : undefined,
      status: b.status ?? "indexed",
      slot: null,
      source: b.sourceType ?? b.source ?? "iot",
      team: teamLabel,
      recordType:
        usedCollection === "batches"
          ? "on-chain (firestore)"
          : `on-chain (firestore:${usedCollection})`,
      count: pointsCount,
      points: pointsCount,
    };
  });

  const lastSeconds = batches[0]?.timestamp?.seconds;
  const lastTs = lastSeconds ? toIsoFromSeconds(lastSeconds) : "—";

  const totals: Totals = {
    files: items.length,
    cids: items.filter((i) => !!i.cid).length,
    onchainTx: items.filter((i) => !!i.tx).length,
    lastTs,
  };

  return { totals, items };
}

// -------- Points summary (M2 proof) --------

function safePoints(n: any) {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

// Adjust this list freely if your team labels evolve.
// We reference human-facing labels seen in the merged items.
const INTERNAL_TEAM_LABELS = new Set<string>([
  "Wakama Core",
  "Wakama_team",
  "Wakama team",
]);

function computePointsSummary(items: NowItem[]): PointsSummary {
  const byTeam: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  let totalPoints = 0;

  for (const it of items) {
    const p = safePoints(it.points ?? it.count);
    totalPoints += p;

    const team = (it.team || "unknown").trim() || "unknown";
    const src = (it.source || "unknown").trim() || "unknown";

    byTeam[team] = (byTeam[team] || 0) + p;
    bySource[src] = (bySource[src] || 0) + p;
  }

  let externalPoints = 0;
  for (const [team, pts] of Object.entries(byTeam)) {
    if (!INTERNAL_TEAM_LABELS.has(team)) {
      externalPoints += pts;
    }
  }

  const externalPct =
    totalPoints > 0 ? (externalPoints / totalPoints) * 100 : 0;

  return {
    totalPoints,
    externalPoints,
    externalPct,
    byTeam,
    bySource,
  };
}

// -------- API --------

export async function GET() {
  try {
    const legacy = await loadLegacyNow();

    let fsNow: Now | null = null;
    try {
      fsNow = await loadFirestoreNow();
    } catch {
      fsNow = null;
    }

    // If Firestore is unavailable or empty, keep M1 behavior intact
    if (!fsNow || fsNow.items.length === 0) {
      const pointsSummary = computePointsSummary(legacy.items || []);
      return NextResponse.json({
        totals: legacy.totals ?? EMPTY.totals,
        items: legacy.items ?? [],
        pointsSummary,
      });
    }

    // Merge items:
    // Firestore (M2+) items on top, legacy (M1) items after.
    const items = [...fsNow.items, ...legacy.items];

    // Totals:
    // M1 totals remain baseline; we simply add FS increments.
    const totals: Totals = {
      files: (legacy.totals?.files ?? 0) + (fsNow.totals?.files ?? 0),
      cids: (legacy.totals?.cids ?? 0) + (fsNow.totals?.cids ?? 0),
      onchainTx:
        (legacy.totals?.onchainTx ?? 0) + (fsNow.totals?.onchainTx ?? 0),
      lastTs:
        fsNow.totals?.lastTs && fsNow.totals.lastTs !== "—"
          ? fsNow.totals.lastTs
          : legacy.totals?.lastTs ?? "—",
    };

    const pointsSummary = computePointsSummary(items);

    return NextResponse.json({ totals, items, pointsSummary });
  } catch {
    return NextResponse.json({
      totals: EMPTY.totals,
      items: [],
      pointsSummary: EMPTY.pointsSummary,
    });
  }
}
