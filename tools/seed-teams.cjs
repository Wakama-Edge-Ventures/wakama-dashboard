/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const saPath = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!saPath) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT");
  process.exit(1);
}

const abs = path.isAbsolute(saPath) ? saPath : path.join(process.cwd(), saPath);
const sa = JSON.parse(fs.readFileSync(abs, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const TEAMS = [
  // Core/internal
    { id: "Wakama_team", name: "Wakama Team", type: "core", external: false },

  // M1 externals existants (si tu veux les normaliser)
  { id: "team-scak-coop", name: "SCAK Cooperative", type: "coop", external: true },
  { id: "team-makm2", name: "MAKM2 Partner", type: "partner", external: true },
  { id: "team-techlab-cme", name: "TechLab CME", type: "university", external: true },

  // ✅ Nouvelles équipes M2
  { id: "team-ujlog", name: "Université Jean Lorougnon Guédé (UJLoG)", type: "university", external: true },
  { id: "team-capn", name: "CAPN – Coopérative Agricole de Petit Nando", type: "coop", external: true },
];

(async () => {
  const col = db.collection("teams");

  for (const t of TEAMS) {
    await col.doc(t.id).set(
      {
        name: t.name,
        type: t.type,
        external: !!t.external,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  console.log("OK: teams seeded/updated:", TEAMS.length);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
