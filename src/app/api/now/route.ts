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
  recordType?: string; // optional to avoid breaking M1 items
};

type Now = { totals: Totals; items: NowItem[] };

const EMPTY: Now = {
  totals: { files: 0, cids: 0, onchainTx: 0, lastTs: "—" },
  items: [],
};

async function loadLegacyNow(): Promise<Now> {
  try {
    const filePath = path.join(process.cwd(), "public", "now.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Now;

    // Defensive: ensure shape
    return {
      totals: parsed?.totals ?? EMPTY.totals,
      items: Array.isArray(parsed?.items) ? parsed.items : [],
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

async function loadFirestoreNow(): Promise<Now> {
  // Read teams
  const teamsSnap = await getDocs(collection(db, "teams"));
  const teams = teamsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  const teamNameById = new Map<string, string>();
  for (const t of teams) {
    if (t?.id) teamNameById.set(t.id, t.name || t.id);
  }

  // Read latest batches (you can adjust limit if needed)
  const batchesQ = query(
    collection(db, "batches"),
    orderBy("timestamp", "desc"),
    limit(200)
  );
  const batchesSnap = await getDocs(batchesQ);

  const batches = batchesSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  const items: NowItem[] = batches.map((b) => {
    const seconds = b?.timestamp?.seconds;
    const teamLabel = teamNameById.get(b.teamId) ?? b.teamId ?? "unknown";

    return {
      cid: b.cid ?? "",
      tx: b.txSignature ?? undefined,
      // We do not have a real "file" name from Firestore,
      // so we provide a stable synthetic label.
      file: b.id ? `batch:${b.id}` : undefined,
      sha256: b.sha256 ?? undefined, // will be undefined unless you add it later
      ts: seconds ? toIsoFromSeconds(seconds) : undefined,
      status: b.status ?? "indexed",
      slot: null,
      source: b.sourceType ?? "iot",
      team: teamLabel,
      recordType: "on-chain (firestore)",
    };
  });

  const lastSeconds = batches[0]?.timestamp?.seconds;
  const lastTs = lastSeconds ? toIsoFromSeconds(lastSeconds) : "—";

  // These are additive counters for the Firestore layer.
  // We DO NOT overwrite M1 totals; we will add these to legacy totals later.
  const totals: Totals = {
    files: items.length,     // treat each batch as one indexed record
    cids: items.filter((i) => !!i.cid).length,
    onchainTx: items.filter((i) => !!i.tx).length,
    lastTs,
  };

  return { totals, items };
}

export async function GET() {
  try {
    const legacy = await loadLegacyNow();

    // If Firebase is not configured for some reason,
    // this will throw and we will fall back to legacy.
    let fsNow: Now | null = null;
    try {
      fsNow = await loadFirestoreNow();
    } catch {
      fsNow = null;
    }

    if (!fsNow) {
      // Keep Milestone 1 behavior untouched
      return NextResponse.json(legacy);
    }

    // Merge items:
    // Firestore (M2) items on top, legacy (M1) items after.
    const items = [...fsNow.items, ...legacy.items];

    // Totals:
    // We keep M1 numbers as baseline and add M2 increments.
    // This avoids "resetting" or "rewriting" the Milestone 1 proof.
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
    // Absolute fallback
    return NextResponse.json(EMPTY);
  }
}
