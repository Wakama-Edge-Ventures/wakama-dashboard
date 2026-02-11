// app/api/capital-pool/route.ts
import { NextResponse } from "next/server";
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

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

function parseMemoFromTx(tx: any): string | null {
  try {
    const ix = tx?.transaction?.message?.instructions ?? [];
    for (const i of ix) {
      // Parsed memo (some RPCs)
      if (i?.program === "spl-memo") {
        if (typeof i?.parsed === "string") return i.parsed;
        if (typeof i?.parsed === "object" && i?.parsed?.memo) return String(i.parsed.memo);
      }

      // Raw memo (Memo program id)
      const pid = i?.programId?.toString?.() ?? i?.programId;
      if (pid === MEMO_PROGRAM_ID && typeof i?.data === "string") {
        // Often base58; keep as-is (still audit-visible)
        return i.data;
      }
    }
  } catch {}
  return null;
}

function getAccountKeys(tx: any): string[] {
  const keys = tx?.transaction?.message?.accountKeys ?? [];
  return keys
    .map((k: any) => {
      if (!k) return null;
      if (typeof k === "string") return k;
      return k?.pubkey?.toString?.() ?? k?.toString?.() ?? null;
    })
    .filter(Boolean) as string[];
}

// Some RPCs return uiAmount as null; fallback to amount/decimals
function uiAmountToNumber(uiTokenAmount: any): number {
  if (!uiTokenAmount) return 0;
  const ui = uiTokenAmount.uiAmount;
  if (typeof ui === "number") return ui;

  const amountStr = uiTokenAmount.amount; // string base units
  const decimals = Number(uiTokenAmount.decimals ?? 0);
  if (typeof amountStr === "string" && amountStr.length) {
    const base = Number(amountStr);
    if (Number.isFinite(base)) return base / Math.pow(10, decimals);
  }
  return 0;
}

function getVaultDeltaUsdc(tx: any, vaultAta: string, usdcMint: string): number {
  const keys = getAccountKeys(tx);
  const vaultIndex = keys.findIndex((k) => k === vaultAta);
  if (vaultIndex < 0) return 0;

  const pre = tx?.meta?.preTokenBalances ?? [];
  const post = tx?.meta?.postTokenBalances ?? [];

  const preByIdx = pre.find((b: any) => b.accountIndex === vaultIndex && b.mint === usdcMint);
  const postByIdx = post.find((b: any) => b.accountIndex === vaultIndex && b.mint === usdcMint);

  const a = uiAmountToNumber(preByIdx?.uiTokenAmount);
  const b = uiAmountToNumber(postByIdx?.uiTokenAmount);

  return +(b - a);
}

function inferTeam(
  tx: any,
  memo: string | null
): { teamId: string | null; teamLabel: string | null } {
  // 1) memo convention: "team=team_etra; purpose=..."
  if (memo) {
    const m = memo.match(/team\s*=\s*([a-zA-Z0-9_:-]+)/);
    if (m?.[1]) {
      const id = m[1];
      return { teamId: id, teamLabel: id.replace("team_", "").toUpperCase() };
    }
  }

  // 2) mapping by known wallets/ATAs appearing in account keys
  try {
    const keys = getAccountKeys(tx);
    for (const k of keys) {
      const hit = (TEAM_MAP as any)[k];
      if (hit) return { teamId: hit.teamId, teamLabel: hit.label };
    }
  } catch {}

  return { teamId: null, teamLabel: null };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

    const conn = new Connection(CAPITAL_POOL.rpc, "confirmed");
    const vaultAta = new PublicKey(CAPITAL_POOL.vaultUsdcAta);

    const sigs = await conn.getSignaturesForAddress(vaultAta, { limit });

    const rows: Row[] = [];
    for (const s of sigs) {
      let tx: any = null;
      try {
        tx = await conn.getTransaction(s.signature, {
          maxSupportedTransactionVersion: 0,
        });
      } catch {
        continue;
      }
      if (!tx) continue;

      const memo = parseMemoFromTx(tx);
      const delta = getVaultDeltaUsdc(tx, CAPITAL_POOL.vaultUsdcAta, CAPITAL_POOL.usdcMint);
      if (delta === 0) continue;

      const type: Row["type"] = delta > 0 ? "DEPOSIT" : "SWEEP";
      const team = inferTeam(tx, memo);

      rows.push({
        signature: s.signature,
        blockTime: tx.blockTime ?? null,
        slot: tx.slot,
        type,
        amountUsdc: +delta,
        teamId: team.teamId,
        teamLabel: team.teamLabel,
        memo,
      });
    }

    const totalDeposits = rows
      .filter((r) => r.amountUsdc > 0)
      .reduce((a, r) => a + r.amountUsdc, 0);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      vaultAta: CAPITAL_POOL.vaultUsdcAta,
      totalDeposits,
      rows,
      ok: true,
    });
  } catch (e: any) {
    // Fallback: serve snapshot files that already exist in /public
    try {
      const base = new URL(req.url);
      const origin = `${base.protocol}//${base.host}`;

      const [summaryRes, receiptsRes] = await Promise.all([
        fetch(`${origin}/capital-pool/mainnet/summary.json`, { cache: "no-store" }),
        fetch(`${origin}/capital-pool/mainnet/receipts.index.json`, { cache: "no-store" }),
      ]);

      const summary = await summaryRes.json();
      const receipts = await receiptsRes.json();

      const items =
        receipts?.items ??
        receipts?.receipts?.items ??
        receipts?.data?.items ??
        [];

      const rows: Row[] = (Array.isArray(items) ? items : []).map((x: any) => ({
        signature: String(x.tx ?? ""),
        blockTime: null,
        slot: 0,
        type: "DEPOSIT",
        amountUsdc: Number(x.amountUsdc ?? 0),
        teamId: x.teamId ?? null,
        teamLabel: x.teamId ? String(x.teamId).replace("team_", "").toUpperCase() : null,
        memo: x.memo ?? null,
      }));

      return NextResponse.json({
        generatedAt: summary?.generatedAt ?? new Date().toISOString(),
        vaultAta: CAPITAL_POOL.vaultUsdcAta,
        totalDeposits: Number(summary?.global?.totalUsdc ?? 0),
        rows,
        ok: false,
        fallback: "static-snapshots",
        error: String(e?.message ?? e),
      });
    } catch (e2: any) {
      return NextResponse.json(
        { ok: false, error: String(e?.message ?? e), error2: String(e2?.message ?? e2) },
        { status: 500 }
      );
    }
  }
}