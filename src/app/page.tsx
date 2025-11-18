// src/app/page.tsx

import Link from "next/link";

const RWA_PROGRAM_ID = "93eL55wjf62Pw8UPsKS8V7b9efk28UyG8C74Vif2gMNR";

export default function Page() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-4 py-10 text-white">
      {/* Background gradients Solana-style */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#020617]" />
        <div className="absolute -top-40 -left-32 h-96 w-[40rem] rotate-12 rounded-full bg-gradient-to-tr from-[#9945FF] via-[#39D0D8] to-[#14F195] blur-3xl opacity-25" />
        <div className="absolute bottom-[-10rem] right-[-10rem] h-[28rem] w-[40rem] -rotate-6 rounded-full bg-gradient-to-tr from-[#14F195] via-[#39D0D8] to-[#9945FF] blur-3xl opacity-20" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        {/* Hero */}
        <section className="flex flex-col items-center text-center gap-6">
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.18em] text-white/70 backdrop-blur">
            Wakama Oracle · RWA Agri On-Chain
          </span>

          <h1 className="max-w-3xl bg-gradient-to-r from-[#14F195] via-[#39D0D8] to-[#9945FF] bg-clip-text text-center text-4xl font-semibold leading-tight text-transparent sm:text-5xl md:text-6xl">
            Live agricultural data,
            <span className="mt-2 block">anchored on Solana Devnet.</span>
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
            Wakama Oracle agrège des lots de capteurs, des livraisons de coopératives
            et des templates RWA, puis les pousse vers IPFS et Solana.
            Suivez en temps réel les points publiés par Wakama et par les équipes
            externes à partir d’un seul tableau de bord.
          </p>

          {/* CTA principaux */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/now-playing"
              className="group inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#14F195] via-[#39D0D8] to-[#9945FF] px-6 py-2.5 text-sm font-semibold text-black shadow-lg shadow-[#14F195]/20 transition-transform hover:scale-[1.02]"
            >
              Open live dashboard
              <span className="ml-2 text-xs transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <a
              href="https://github.com/Wakama-Edge-Ventures/wakama-oracle-publisher"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-black/30 px-5 py-2.5 text-sm font-medium text-white/85 backdrop-blur transition-colors hover:border-[#14F195]/60 hover:text-[#14F195]"
            >
              View publisher code on GitHub
            </a>
          </div>

          {/* Meta line */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[11px] text-white/45">
            <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
              Devnet only · No mainnet funds
            </span>
            <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
              IPFS + Solana · RWA telemetry
            </span>
          </div>
        </section>

        {/* Section cartes : Oracle live + RWA sample contract */}
        <section className="grid w-full gap-6 md:grid-cols-2">
          {/* Carte live oracle */}
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 shadow-lg shadow-black/40 backdrop-blur">
            <h2 className="text-sm font-semibold text-white/90">
              Live Oracle Stream
            </h2>
            <p className="text-xs text-white/60">
              Visualisation temps réel des lots de données (points capteurs, batches)
              publiés sur Solana Devnet par Wakama Oracle et les équipes partenaires.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
              <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-300">
                Milestone 1 · 150k+ points (objectif)
              </span>
              <span className="rounded-full bg-white/10 px-2 py-1">
                Source: now.json + Devnet tx
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/now-playing"
                className="inline-flex items-center justify-center rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-[#14F195] hover:text-black"
              >
                Open live dashboard
              </Link>
            </div>
          </div>

          {/* Carte RWA sample contract */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[#14F195]/30 bg-black/40 p-4 shadow-lg shadow-emerald-500/20 backdrop-blur">
            <h2 className="text-sm font-semibold text-white/90">
              RWA Sample Contract (Devnet)
            </h2>
            <p className="text-xs text-white/60">
              Contrat d&apos;exemple qui expose un asset RWA unique, agrège les points
              oracle, gère le statut (Pending/Active/Redeemed/Defaulted) et suit un
              volume investi en USDC.
            </p>

            <div className="mt-1 rounded-lg bg-black/60 p-2 text-[11px] font-mono text-white/70">
              <div className="text-white/50">Program ID (devnet)</div>
              <div className="truncate text-[#14F195]">{RWA_PROGRAM_ID}</div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Link
                href="/rwa-contract"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#14F195] to-[#39D0D8] px-4 py-1.5 font-semibold text-black hover:opacity-95"
              >
                View details &amp; source
              </Link>
              <a
                href={`https://explorer.solana.com/address/${RWA_PROGRAM_ID}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-black/40 px-4 py-1.5 text-white/80 hover:border-[#14F195]/70 hover:text-[#14F195]"
              >
                Open on Solana Explorer
              </a>
              <a
                href="https://github.com/Wakama-Edge-Ventures/wakama-oracle-anchor"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-white/75 hover:border-[#39D0D8]/70 hover:text-[#39D0D8]"
              >
                View program repo
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full border-t border-white/10 pt-4 text-center text-[11px] text-white/60">
          © 2025{" "}
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
        </footer>
      </div>
    </main>
  );
}
