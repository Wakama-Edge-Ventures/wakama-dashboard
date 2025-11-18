import React from "react";
import Link from 'next/link';


export const dynamic = "force-dynamic";

const PROGRAM_ID = "93eL55wjf62Pw8UPsKS8V7b9efk28UyG8C74Vif2gMNR";
const REPO_URL =
  "https://github.com/Wakama-Edge-Ventures/wakama-oracle-anchor";
const RAW_LIB_URL =
  "https://raw.githubusercontent.com/Wakama-Edge-Ventures/wakama-oracle-anchor/main/programs/wakama-oracle-anchor/src/lib.rs";

async function fetchLibRs(): Promise<string> {
  try {
    const res = await fetch(RAW_LIB_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } catch {
    return "// Unable to fetch lib.rs from GitHub. Please open the repo directly.\n";
  }
}

export default async function Page() {
  const libRs = await fetchLibRs();

  return (
    <main className="relative mx-auto min-h-screen max-w-6xl overflow-hidden px-6 py-8 text-white">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#050711]" />
        <div className="absolute -top-24 -left-40 h-80 w-[38rem] rotate-12 rounded-full bg-gradient-to-tr from-[#9945FF] via-[#39D0D8] to-[#14F195] blur-3xl opacity-25" />
        <div className="absolute bottom-[-8rem] right-[-8rem] h-96 w-[42rem] -rotate-6 rounded-full bg-gradient-to-tr from-[#14F195] via-[#39D0D8] to-[#9945FF] blur-3xl opacity-15" />
      </div>

      {/* Top bar */}
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/"
            className="text-lg font-semibold tracking-tight hover:text-[#14F195] transition-colors"
          >
            · Wakama Oracle
          </Link>
          <span className="text-xs text-white/40">RWA Sample Contract</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] text-emerald-200">
            Devnet
          </span>
        </div>
      </header>

      <section className="mb-6 grid gap-4 md:grid-cols-[1.3fr,1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/5/5 p-4 backdrop-blur">
          <h1 className="text-xl font-semibold mb-2">
            RWA Sample Contract (Wakama Oracle)
          </h1>
          <p className="text-sm text-white/70 mb-3">
            This page mirrors Solscan-style information for the devnet RWA demo
            contract backing Wakama Oracle Milestone 1.
          </p>
          <div className="space-y-2 text-[12px]">
            <div>
              <span className="text-white/50">Program ID:&nbsp;</span>
              <code className="rounded bg-black/50 px-1 py-0.5 text-[11px]">
                {PROGRAM_ID}
              </code>
            </div>
            <div>
              <span className="text-white/50">Cluster:&nbsp;</span>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-200 text-[11px]">
                devnet
              </span>
            </div>
            <div>
              <span className="text-white/50">Explorer:&nbsp;</span>
              <a
                href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted underline-offset-2 hover:text-[#14F195]"
              >
                View on Solana Explorer
              </a>
            </div>
            <div>
              <span className="text-white/50">GitHub:&nbsp;</span>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted underline-offset-2 hover:text-[#14F195]"
              >
                wakama-oracle-anchor
              </a>
            </div>
          </div>

          <div className="mt-4 text-[12px] text-white/65 space-y-1">
            <div>
              <span className="font-semibold text-white/80">Instructions:</span>{" "}
              <code>initialize_asset</code>, <code>push_oracle_update</code>,{" "}
              <code>set_status</code>, <code>record_investment</code>
            </div>
            <div>
              <span className="font-semibold text-white/80">RWA fields:</span>{" "}
              oracle points &amp; batches, lifecycle status, invested USDC,
              timestamps &amp; slots.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur text-[12px] text-white/70 space-y-2">
          <h2 className="text-sm font-medium text-white mb-2">
            How this ties to Wakama Oracle
          </h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <span className="font-semibold text-white/80">
                Oracle → Contract:
              </span>{" "}
              the Wakama Oracle publisher calls{" "}
              <code>push_oracle_update</code> to aggregate data batches
              (soil/NDVI/coop).
            </li>
            <li>
              <span className="font-semibold text-white/80">Dashboard:</span>{" "}
              the dashboard reads devnet activity and can show points, batches &
              status next to on-chain receipts.
            </li>
            <li>
              <span className="font-semibold text-white/80">
                Investment metric:
              </span>{" "}
              <code>record_investment</code> tracks a simple USDC volume, used
              for the grant “$20k invested” milestone.
            </li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">
            Code source (lib.rs)
          </h2>
          <a
            href={RAW_LIB_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-white/50 underline decoration-dotted underline-offset-2 hover:text-[#14F195]"
          >
            Open raw file on GitHub
          </a>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#050711]">
          <pre className="max-h-[560px] overflow-auto p-4 text-[11px] leading-relaxed font-mono text-[#E5E7EB]">
            {libRs}
          </pre>
        </div>
      </section>

      <footer className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-[11px] text-white/60 pb-10">
        <span>
          © {new Date().getUTCFullYear()}{" "}
          <a
            href="https://wakama.farm"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-4 hover:text-[#14F195]"
          >
            Wakama.farm
          </a>{" "}
          supported by{" "}
          <a
            href="https://solana.org"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-4 hover:text-[#14F195]"
          >
            Solana Foundation
          </a>
        </span>
        <a
          href="/now-playing"
          className="rounded-lg border border-white/15 px-2 py-1 hover:bg-[#14F195]/15 transition-colors"
        >
          ← Back to dashboard
        </a>
      </footer>
    </main>
  );
}
