// src/app/api/rwa-demo/route.ts
import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export const dynamic = "force-dynamic";

type TeamDoc = {
  name?: string;
  type?: string;
  external?: boolean;
};

type BatchDoc = {
  cid?: string;
  teamId?: string;
  txSignature?: string;
  rwaId?: string;
  deviceId?: string;
  pointsCount?: number;
  sourceType?: string;
  timestamp?: { seconds?: number; nanoseconds?: number };
};

type RwaDoc = {
  name?: string;
  teamId?: string;
  region?: string;
  status?: string;
  network?: string;
  mintAddress?: string;
  createdAt?: { seconds?: number; nanoseconds?: number };
};

export async function GET() {
  try {
    const [batchesSnap, rwasSnap, teamsSnap] = await Promise.all([
      getDocs(collection(db, "batches")),
      getDocs(collection(db, "rwas")),
      getDocs(collection(db, "teams")),
    ]);

    const batches = batchesSnap.docs.map((d) => {
      const data = d.data() as BatchDoc;
      return {
        id: d.id,
        ...data,
        pointsCount: typeof data.pointsCount === "number" ? data.pointsCount : 0,
      };
    });

    const rwas = rwasSnap.docs.map((d) => {
      const data = d.data() as RwaDoc;
      return {
        id: d.id,
        ...data,
      };
    });

    const teams = teamsSnap.docs.map((d) => {
      const data = d.data() as TeamDoc;
      return {
        id: d.id,
        name: data.name ?? d.id,
        type: data.type ?? "unknown",
        external: Boolean(data.external),
      };
    });

    return NextResponse.json({ batches, rwas, teams });
  } catch (e) {
    console.error("Firebase error", e);
    return NextResponse.json({ error: "firebase-error" }, { status: 500 });
  }
}
