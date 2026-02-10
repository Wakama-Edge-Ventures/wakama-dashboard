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

      // Raw memo programId
      const pid = i?.programId?.toString?.() ?? i?.programId;
      if (pid === MEMO_PROGRAM_ID && typeof i?.data === "string") {
        // Often base58; we keep as-is to avoid breaking, it's still “audit visible”
        return i.data;
      }
    }
  } catch {}
  return null;
}

function getAccountKeys(tx: any): string[] {
  const keys = tx?.transaction?.message?.accountKeys ?? [];
  return keys.map((k: any) => k?.pubkey?.toString?.() ?? k?.toString?.());
}

function getVaultDeltaUsdc(tx: any, vaultAta: string, usdcMint: string): number {
  const keys = getAccountKeys(tx);
  const vaultIndex = keys.findIndex((k) => k === vaultAta);
  if (vaultIndex < 0) return 0;

  const pre = tx?.meta?.preTokenBalances ?? [];
  const post = tx?.meta?.postTokenBalances ?? [];

  const preByIdx = pre.find((b: any) => b.accountIndex === vaultIndex && b.mint === usdcMint);
  const postByIdx = post.find((b: any) => b.accountIndex === vaultIndex && b.mint === usdcMint);

  const a = Number(preByIdx?.uiTokenAmount?.uiAmount ?? 0);
  const b = Number(postByIdx?.uiTokenAmount?.uiAmount ?? 0);

  // delta of vault ATA balance
  return +(b - a);
}

function inferTeam(tx: any, memo: string | null): { teamId: string | null; teamLabel: string | null } {
  // 1) memo convention: "team=team_etra; purpose=..."
  if (memo) {
    const m = memo.match(/team\s*=\s*([a-zA-Z0-9_:-]+)/);
    if (m?.[1]) {
      const id = m[1];
      return { teamId: id, teamLabel: id.replace("team_", "").toUpperCase() };
    }
  }

  // 2) mapping by known wallets/atas appearing in account keys
  try {
    const keys = getAccountKeys(tx);
    for (const k of keys) {
      const hit = TEAM_MAP[k];
      if (hit) return { teamId: hit.teamId, teamLabel: hit.label };
    }
  } catch {}

  return { teamId: null, teamLabel: null };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

  const conn = new Connection(CAPITAL_POOL.rpc, "confirmed");
  const vaultAtaPk = new PublicKey(CAPITAL_POOL.vaultUsdcAta);

  const sigs = await conn.getSignaturesForAddress(vaultAtaPk, { limit });

  const rows: Row[] = [];
  for (const s of sigs) {
    const tx = await conn.getTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
    if (!tx) continue;

    const memo = parseMemoFromTx(tx);
    const delta = getVaultDeltaUsdc(tx, CAPITAL_POOL.vaultUsdcAta, CAPITAL_POOL.usdcMint);

    // keep only transactions that actually change vault USDC balance
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
  });
}