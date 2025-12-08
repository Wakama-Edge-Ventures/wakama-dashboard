
# Wakama Solana Stack — Milestone 2 Proof

## Scope
Milestone 2 validates:
1) Public RWA dashboard with real-time monitoring.
2) Firestore/IPFS integration for scalable indexing.
3) Early economic & governance readiness through Realms.
4) 200,000+ new test/simulated data points on-chain after M1 cutoff,
   with 70%+ coming from external teams.

This folder contains the minimal proof artifacts used by the dashboard panel:
- `m2-summary.json`
- `m2-proof.json`

## Data sources
- On-chain IoT batches published to Solana Devnet (memo includes cid/sha256/count/ts range/team).
- IPFS CIDs (Pinata gateway).
- Firestore batches collections (legacy + M2 collections).
- Aggregated snapshot exposed by `/api/now`.

## Rules / interpretation
- New points target: `>= 200,000` after cutoff.
- External ratio target: `>= 70%` of new points.
- Adoption: satisfied by RWA mint OR sustained usage.
  For M2 reporting, the RWA mint path is considered sufficient and
  the active-days rule is treated as a supporting signal rather than a hard gate.

## Governance (DAO)
Wakama governance for oracle feeds is enabled via Realms (Solana).
The DAO is intended to:
- validate/approve oracle feed parameters,
- curate recognized external teams,
- oversee RWA listing policies for early pilots.

The dashboard references DAO readiness as part of the M2 technical scope.
Live public dashboard

Firestore/IPFS OK

M2 points + external % OK

Realms: “Oracle Feeds Policy v1 (M2)” created to govern wave/feed and counting rules.
