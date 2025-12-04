// src/app/api/now/route.ts
import { NextResponse } from "next/server";
import { collection, getDocs, orderBy, limit, query } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

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

const EMPTY: Now = {
  totals: { files: 0, cids: 0, onchainTx: 0, lastTs: "—" },
  items: [],
};

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // On lit directement la collection Firestore "batches"
    const q = query(
      collection(db, "batches"),
      orderBy("timestamp", "desc"),
      limit(50), // on prend les 50 derniers lots max
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      return NextResponse.json(EMPTY);
    }

    const items: NowItem[] = snap.docs.map((doc) => {
      const data = doc.data() as any;
      const tsSeconds = data.timestamp?.seconds as number | undefined;
      const ts =
        tsSeconds !== undefined
          ? new Date(tsSeconds * 1000).toISOString()
          : undefined;

      return {
        cid: data.cid,
        tx: data.txSignature,
        ts,
        source: data.sourceType ?? "iot",
        status: "indexed",
        slot: null,
        // file / sha256 ne sont pas encore fournis par Firestore,
        // on les laisse undefined.
      };
    });

    const uniqueCids = new Set(items.map((i) => i.cid).filter(Boolean));

    const totals: Totals = {
      files: items.length,
      cids: uniqueCids.size,
      onchainTx: items.filter((i) => i.tx).length,
      lastTs: items[0]?.ts ?? "—",
    };

    return NextResponse.json({ totals, items });
  } catch (err) {
    console.error("Error in /api/now:", err);
    return NextResponse.json(EMPTY);
  }
}
