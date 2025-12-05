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

type Now = { totals: Totals; items: NowItem[] };

const EMPTY: Now = {
  totals: { files: 0, cids: 0, onchainTx: 0, lastTs: "—" },
  items: [],
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
    const normalizedLegacyItems: NowItem[] = legacyItems.map((it: any) => ({
      ...it,
      recordType: it?.recordType ?? "on-chain (publisher)",
      points:
        typeof it?.points === "number"
          ? it.points
          : typeof it?.pointsCount === "number"
          ? it.pointsCount
          : 0,
    }));

    return {
      totals: parsed?.totals ?? EMPTY.totals,
      items: normalizedLegacyItems,
    };
  } catch {
    return EMPTY;
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
  // If your doc uses another field (createdAt, ts, etc.),
  // you can extend this later.
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
    const teamId = b.teamId ?? b.team ?? b.team_id;
    const teamLabel = teamNameById.get(teamId) ?? teamId ?? "unknown";

    const cid = b.cid ?? b.ipfsCid ?? b.ipfs_cid ?? "";
    const tx = b.txSignature ?? b.tx ?? b.signature ?? undefined;

    const pointsCount =
  typeof points === "number"
    ? points
    : typeof b.pointsCount === "number"
    ? b.pointsCount
    : typeof b.points === "number"
    ? b.points
    : 0;

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
  count: pointsCount,   // <-- pour NowPlaying UI
  points: pointsCount,  // <-- compat existante
};


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

    if (!fsNow || fsNow.items.length === 0) {
      // Keep Milestone 1 behavior intact
      return NextResponse.json(legacy);
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

    return NextResponse.json({ totals, items });
  } catch {
    return NextResponse.json(EMPTY);
  }
}

