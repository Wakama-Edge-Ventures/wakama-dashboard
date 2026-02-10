// lib/capitalPoolConfig.ts
export const CAPITAL_POOL = {
  cluster: "mainnet-beta",
  rpc: process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com",
  usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  vaultUsdcAta: "E4qx5EmoaRc2SYSTAfwbgFiDBf6RuvRftW4mWpRXPVLe",
};

// mapping known teams (wallets/atas)
// (tu peux compléter au fur et à mesure)
export const TEAM_MAP: Record<string, { teamId: string; label: string }> = {
  // team wallets
  "311JpSVRih2ZYMU7rVf2snpUUqWUzF2LKFoZSBG7BrWk": { teamId: "team_mks", label: "MKS" },
  "DyF54aoEUjHXq6yVnuYd6mVMAfXZC1QEDFgrXjU9rKQ4": { teamId: "team_etra", label: "ETRA" },

  // team USDC ATAs (optionnel)
  "8EefksgtNiM61JMBeinWCnjCHd8RkZXRsvkkAfj2r5Vy": { teamId: "team_mks", label: "MKS" },
  "7XMeZ3Y9MZYgqeGymgptKTwaAAg3s4dRg19FbvY2Sfbm": { teamId: "team_etra", label: "ETRA" },
};