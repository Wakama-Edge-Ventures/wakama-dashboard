// src/app/api/rwa-demo/route.ts
import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [batchesSnap, rwasSnap, teamsSnap] = await Promise.all([
      getDocs(collection(db, "batches")),
      getDocs(collection(db, "rwas")),
      getDocs(collection(db, "teams")),
    ]);

    const batches = batchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const rwas = rwasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const teams = teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ batches, rwas, teams });
  } catch (e) {
    console.error("Firebase error", e);
    return NextResponse.json({ error: "firebase-error" }, { status: 500 });
  }
}
