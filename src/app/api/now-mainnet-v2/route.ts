// src/app/api/now-mainnet-v2/route.ts

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Firebase
import { db } from "@/lib/firebaseClient";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

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

type PointsSummary = {
  totalPoints: number;
  externalPoints: number;
  externalPct: number;
  byTeam: Record<string, number>;
  bySource: Record<string, number>;
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
   MAINNET TEAM ALLOWLIST
   => prevents “devnet” teams leaking into mainnet totals/UI.
   Keep ONLY the teams you consider part of mainnet tracking.
========================= */
const MAINNET_TEAMS_ALLOWLIST = new Set<string>([
  "team-capn",
  "team_CNRA",
  "team-makm2",
  "team_mks",
  "team-scak-coop",
  "team-techlab-cme",
  "Wakama_team",
  "team-uJlog",
]);

function isAllowedMainnetTeam(team?: string) {
  const t = (team || "").trim();
  if (!t) return false;
  if (/devnet/i.test(t)) return false; // extra safety
  return MAINNET_TEAMS_ALLOWLIST.has(t);
}

function filterMainnetItems(items: NowItem[]) {
  // Filter out anything not in allowlist
  return (items || []).filter((it) => isAllowedMainnetTeam(it.team));
}

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
   FIRESTORE (ESP32 -> ingest -> batches)
   NOTE: We keep this for later merge; it can be switched on/off.
========================= */

function toIsoFromSeconds(seconds?: number) {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toISOString();
}

async function loadFirestoreNow(): Promise<Now> {
  try {
    const qy = query(
      collection(db, "batches"),
      orderBy("timestamp", "desc"),
      limit(200),
    );

    const snap = await getDocs(qy);
    if (snap.empty) return { totals: EMPTY.totals, items: [] };

    const items: NowItem[] = snap.docs.map((d) => {
      const data = d.data() as any;

      const seconds = data?.timestamp?.seconds;
      const points =
        typeof data?.points === "number"
          ? data.points
          : typeof data?.pointsCount === "number"
          ? data.pointsCount
          : typeof data?.count === "number"
          ? data.count
          : 0;

      return {
        cid: data?.cid ?? "",
        tx: data?.txSignature ?? undefined,
        file: `batch:${d.id}`,
        sha256: data?.sha256 ?? undefined,
        ts: seconds ? toIsoFromSeconds(seconds) : undefined,
        status: data?.status ?? "indexed",
        slot: null,
        source: data?.sourceType ?? data?.source ?? "iot",
        team: data?.teamId ?? "unknown",
        recordType: "on-chain (firestore)",
        count: points,
        points,
      };
    });

    const first = snap.docs[0]?.data() as any;
    const lastSeconds = first?.timestamp?.seconds;

    const totals: Totals = {
      files: items.length,
      cids: items.filter((i) => !!i.cid).length,
      onchainTx: items.filter((i) => !!i.tx).length,
      lastTs: lastSeconds ? toIsoFromSeconds(lastSeconds) : "—",
    };

    return { totals, items };
  } catch {
    return { totals: EMPTY.totals, items: [] };
  }
}

/* =========================
   TEAM LABEL NORMALIZATION (prevents “unknown”/aliases)
========================= */

async function loadTeamsMap() {
  const snap = await getDocs(collection(db, "teams"));
  const map = new Map<string, string>();

  for (const doc of snap.docs) {
    const data = doc.data() as any;
    const name = (data?.name || doc.id) as string;
    map.set(doc.id, name);
  }

  // Optional hard aliases (safe)
  map.set("team_wakama", "Wakama Team");
  map.set("Wakama Core", "Wakama Team");

  return map;
}

function normalizeItemsTeams(items: NowItem[], teamNameById: Map<string, string>) {
  return items.map((it) => {
    const key = (it.team || "").trim();
    const mapped = key ? teamNameById.get(key) : undefined;
    return mapped ? { ...it, team: mapped } : it;
  });
}

/* =========================
   POINTS SUMMARY
========================= */

const INTERNAL_TEAM_LABELS = new Set<string>(["Wakama_team", "Wakama Team", "Wakama team"]);

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
  for (const [team, pts] of Object.entries(byTeam)) {
    if (!INTERNAL_TEAM_LABELS.has(team)) externalPoints += pts;
  }

  const externalPct = totalPoints > 0 ? (externalPoints / totalPoints) * 100 : 0;

  return { totalPoints, externalPoints, externalPct, byTeam, bySource };
}

/* =========================
   API HANDLER
   Current mode (safe): V2 returns ONLY publisher snapshot.
   Firestore is kept ready; flip MERGE_FIRESTORE=true when you want to include ESP32 batches.
========================= */

const MERGE_FIRESTORE = process.env.NOW_MAINNET_V2_MERGE_FIRESTORE === "true";

export async function GET() {
  try {
    const legacyRaw = await loadLegacyNow();

    // Normalize team labels (does not change points, only labels)
    let teamNameById: Map<string, string> | null = null;
    try {
      teamNameById = await loadTeamsMap();
    } catch {
      teamNameById = null;
    }

    // 1) Start with legacy snapshot
    const legacyBase: Now = {
      totals: legacyRaw.totals,
      items: legacyRaw.items || [],
    };

    // 2) Enforce mainnet-only teams BEFORE any merge/summary
    //    => removes devnet leftovers like capn_san_pedro.
    let items: NowItem[] = filterMainnetItems(legacyBase.items);

    // 3) Optional: merge Firestore (still filtered mainnet-only)
    if (MERGE_FIRESTORE) {
      const firestoreRaw = await loadFirestoreNow();
      const firestoreItems = filterMainnetItems(firestoreRaw.items || []);
      // Firestore first (fresh), then legacy snapshot
      items = [...firestoreItems, ...items];
    }

    // 4) Only now normalize labels for display
    if (teamNameById) {
      items = normalizeItemsTeams(items, teamNameById);
    }

    // Totals computed from returned items (no surprises)
    const totals: Totals = {
      files: items.length,
      cids: items.filter((i) => !!i.cid).length,
      onchainTx: items.filter((i) => !!i.tx).length,
      lastTs: items[0]?.ts || legacyRaw.totals?.lastTs || "—",
    };

    const pointsSummary = computePointsSummary(items);

    return NextResponse.json(
      { totals, items, pointsSummary },
      {
        headers: {
          "cache-control": "no-store, max-age=0",
        },
      },
    );
  } catch {
    return NextResponse.json(EMPTY, {
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    });
  }
}