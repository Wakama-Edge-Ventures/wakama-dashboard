// app/api/capital-pool/route.ts
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Connection, PublicKey } from "@solana/web3.js";
import { CAPITAL_POOL, TEAM_MAP } from "@/lib/capitalPoolConfig";

type Row = {
  signature: string;
  blockTime: number | null;
  slot: number;
  type: "DEPOSIT" | "SWEEP" | "OTHER";
  amountUsdc: number; // +deposit, -sweep
  teamId: string | null;
  teamLabel: string | null;
  memo: string | null;
};

type SnapshotSummary = any;
type SnapshotIndex = { items?: any[]; generatedAt?: string; count?: number };

function safeJsonRead(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function snapshotPaths() {
  // Next.js build output still has project root; public is available here.
  const root = process.cwd();
  return {
    summary: path.join(root, "public", "capital-pool", "mainnet", "summary.json"),
    receipts: path.join(root, "public", "capital-pool", "mainnet", "receipts.index.json"),
  };
}

function rowsFromSnapshots(summary: SnapshotSummary, receipts: SnapshotIndex): { rows: Row[]; totalDeposits: number } {
  const items = Array.isArray(receipts?.items) ? receipts.items : [];

  const totalFromSummary = Number(summary?.global?.totalUsdc ?? 0);

  // We only have DEPOSIT rows in receipts.index.json (your generator indexes receipts)
  const rows: Row[] = items.map((x: any) => {
    const teamId = x.teamId ?? null;
    const teamLabel = teamId ? String(teamId).replace("team_", "").toUpperCase() : null;

    // createdAt in receipts index is ISO string. We keep blockTime null to avoid false precision.
    // If you want, we can parse createdAt to blockTime later (but that would be "not on-chain time").
    const memo = x.memo ?? null;

    return {
      signature: String(x.tx ?? ""),
      blockTime: null,
      slot: 0,
      type: "DEPOSIT",
      amountUsdc: Number(x.amountUsdc ?? 0),
      teamId,
      teamLabel,
      memo,
    };
  });

  // If summary exists, trust it (Amira-proof snapshot)
  const totalDeposits = Number.isFinite(totalFromSummary)
    ? totalFromSummary
    : rows.filter((r) => r.amountUsdc > 0).reduce((a, r) => a + r.amountUsdc, 0);

  return { rows, totalDeposits };
}

/**
 * Lightweight RPC mode:
 * - only fetch signatures list (cheap-ish)
 * - do NOT call getTransaction per signature (this is what triggers 429)
 * - returns rows with type=OTHER and amountUsdc=0, just for "live tx list" placeholder
 *
 * If you really want amount/memo from chain, we can add an opt-in mode:
 *   /api/capital-pool?mode=full&limit=20
 * that fetches transactions but small limit + throttling.
 */
async function rpcLight(limit: number) {
  const conn = new Connection(CAPITAL_POOL.rpc, "confirmed");
  const vaultAta = new PublicKey(CAPITAL_POOL.vaultUsdcAta);

  const sigs = await conn.getSignaturesForAddress(vaultAta, { limit });

  const rows: Row[] = sigs.map((s) => {
    // Infer team from known keys in signature info is impossible; keep null.
    return {
      signature: s.signature,
      blockTime: s.blockTime ?? null,
      slot: s.slot,
      type: "OTHER",
      amountUsdc: 0,
      teamId: null,
      teamLabel: null,
      memo: null,
    };
  });

  return { rows };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Keep limits small by default to avoid RPC pressure.
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);

  // mode:
  // - "snapshot" forces snapshot mode
  // - "rpc" forces rpcLight mode
  const mode = (searchParams.get("mode") ?? "auto").toLowerCase();

  // 1) SNAPSHOT forced
  if (mode === "snapshot") {
    try {
      const p = snapshotPaths();
      const summary = safeJsonRead(p.summary);
      const receipts = safeJsonRead(p.receipts);
      const { rows, totalDeposits } = rowsFromSnapshots(summary, receipts);

      return NextResponse.json({
        ok: true,
        mode: "snapshot",
        fallback: null,
        generatedAt: summary?.generatedAt ?? new Date().toISOString(),
        vaultAta: CAPITAL_POOL.vaultUsdcAta,
        totalDeposits,
        rows,
      });
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, mode: "snapshot", error: String(e?.message ?? e) },
        { status: 500 }
      );
    }
  }

  // 2) RPC forced (light)
  if (mode === "rpc") {
    try {
      const { rows } = await rpcLight(limit);
      return NextResponse.json({
        ok: true,
        mode: "rpc-light",
        generatedAt: new Date().toISOString(),
        vaultAta: CAPITAL_POOL.vaultUsdcAta,
        totalDeposits: null, // not computed in light mode
        rows,
      });
    } catch (e: any) {
      // If rpc fails, fall back to snapshots
      modeFallbackSnapshot: {
        try {
          const p = snapshotPaths();
          const summary = safeJsonRead(p.summary);
          const receipts = safeJsonRead(p.receipts);
          const { rows, totalDeposits } = rowsFromSnapshots(summary, receipts);

          return NextResponse.json({
            ok: false,
            mode: "rpc-light",
            fallback: "snapshot",
            error: String(e?.message ?? e),
            generatedAt: summary?.generatedAt ?? new Date().toISOString(),
            vaultAta: CAPITAL_POOL.vaultUsdcAta,
            totalDeposits,
            rows,
          });
        } catch (e2: any) {
          return NextResponse.json(
            { ok: false, mode: "rpc-light", error: String(e?.message ?? e), error2: String(e2?.message ?? e2) },
            { status: 500 }
          );
        }
      }
    }
  }

  // 3) AUTO: try rpc-light first, but ALWAYS return snapshot totals/rows if available.
  // This is the safest for Amira-proof + UI stability.
  try {
    // First try reading snapshots from disk (fast, no rate limit)
    const p = snapshotPaths();
    const summary = safeJsonRead(p.summary);
    const receipts = safeJsonRead(p.receipts);
    const { rows, totalDeposits } = rowsFromSnapshots(summary, receipts);

    // Optionally enrich with rpc-light signatures (last N txs) without breaking if it fails
    let rpcRows: Row[] = [];
    try {
      const r = await rpcLight(Math.min(limit, 20));
      rpcRows = r.rows;
    } catch {
      rpcRows = [];
    }

    return NextResponse.json({
      ok: true,
      mode: "auto",
      generatedAt: summary?.generatedAt ?? new Date().toISOString(),
      vaultAta: CAPITAL_POOL.vaultUsdcAta,
      totalDeposits,
      rows, // snapshot rows (DEPOSIT)
      rpcRows, // optional list of last signatures (OTHER)
    });
  } catch (e: any) {
    // If snapshots missing, attempt rpc-light only
    try {
      const { rows } = await rpcLight(limit);
      return NextResponse.json({
        ok: false,
        mode: "auto",
        fallback: "rpc-light",
        error: String(e?.message ?? e),
        generatedAt: new Date().toISOString(),
        vaultAta: CAPITAL_POOL.vaultUsdcAta,
        totalDeposits: null,
        rows,
      });
    } catch (e2: any) {
      return NextResponse.json(
        { ok: false, mode: "auto", error: String(e?.message ?? e), error2: String(e2?.message ?? e2) },
        { status: 500 }
      );
    }
  }
}