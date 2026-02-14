import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

type IngestBody = {
  team?: string;
  site?: string;
  subteam?: string;
  device?: string;
  ts?: number;
  ntp_synced?: boolean;
  ok?: boolean;
  rssi?: number;
  ip?: string;
  sensors?: Record<string, unknown>;
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getDb() {
  if (!getApps().length) {
    const projectId = mustEnv("FIREBASE_PROJECT_ID");
    const clientEmail = mustEnv("FIREBASE_CLIENT_EMAIL");
    const privateKeyRaw = mustEnv("FIREBASE_PRIVATE_KEY");
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return getFirestore();
}

function json(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET() {
  return json(200, { ok: true, route: "/api/iot/ingest" });
}

export async function POST(req: Request) {
  const deviceKey = req.headers.get("x-device-key") || "";
  if (!deviceKey) return json(401, { ok: false, error: "missing_x_device_key" });

  const body = (await req.json().catch(() => null)) as IngestBody | null;
  if (!body) return json(400, { ok: false, error: "invalid_json" });

  const teamId = body.team;
  const siteId = body.site;
  const subteamId = body.subteam;
  const deviceId = body.device;
  const ts = body.ts;

  if (!teamId || !siteId || !subteamId || !deviceId || !ts) {
    return json(422, {
      ok: false,
      error: "missing_fields",
      required: ["team", "site", "subteam", "device", "ts"],
      got: {
        team: !!teamId,
        site: !!siteId,
        subteam: !!subteamId,
        device: !!deviceId,
        ts: !!ts,
      },
    });
  }

  const db = getDb();

  // 1) Registry check: iot_devices/{deviceId}
  const regRef = db.collection("iot_devices").doc(String(deviceId));
  const regSnap = await regRef.get();
  if (!regSnap.exists) return json(403, { ok: false, error: "device_not_registered" });

  const reg = regSnap.data() || {};
  if (reg.enabled !== true) return json(403, { ok: false, error: "device_disabled" });

  if (String(reg.deviceKey || "") !== deviceKey) {
    return json(403, { ok: false, error: "invalid_device_key" });
  }

  // 2) Lock identity to registry (prevents spoof)
  const regTeam = String(reg.teamId || "");
  const regSite = String(reg.siteId || "");
  const regSub = String(reg.subteamId || "");

  if (regTeam && regTeam !== String(teamId)) return json(403, { ok: false, error: "team_mismatch" });
  if (regSite && regSite !== String(siteId)) return json(403, { ok: false, error: "site_mismatch" });
  if (regSub && regSub !== String(subteamId)) return json(403, { ok: false, error: "subteam_mismatch" });

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  // 3) Persist telemetry raw
  const doc = {
    teamId,
    siteId,
    subteamId,
    deviceId,
    ts,
    ntpSynced: !!body.ntp_synced,
    ok: !!body.ok,
    rssi: typeof body.rssi === "number" ? body.rssi : null,
    ip: body.ip || null,
    clientIp,
    sensors: body.sensors || {},
    receivedAt: FieldValue.serverTimestamp(),
  };

  const writeRef = await db.collection("iot_telemetry_raw").add(doc);

  return json(200, { ok: true, id: writeRef.id });
}