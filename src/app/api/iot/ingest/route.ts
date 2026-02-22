import { createClient } from "@supabase/supabase-js";

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

function getSupabase() {
  const url = mustEnv("SUPABASE_URL");
  const serviceKey = mustEnv("SUPABASE_SERVICE_KEY"); // service_role
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
  try {
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
      });
    }

    const supabase = getSupabase();

    // Registry lookup (public.iot_devices)
    const { data: reg, error: regErr } = await supabase
      .from("iot_devices")
      .select("device_id, device_key, enabled, team_id, site_id, subteam_id")
      .eq("device_id", String(deviceId))
      .maybeSingle();

    if (regErr) {
      return json(500, { ok: false, error: "db_error", stage: "device_lookup", message: regErr.message });
    }
    if (!reg) return json(403, { ok: false, error: "device_not_registered" });
    if (reg.enabled !== true) return json(403, { ok: false, error: "device_disabled" });

    if (String(reg.device_key || "") !== deviceKey) {
      return json(403, { ok: false, error: "invalid_device_key" });
    }

    const regTeam = String(reg.team_id || "");
    const regSite = String(reg.site_id || "");
    const regSub = String(reg.subteam_id || "");

    if (regTeam && regTeam !== String(teamId)) return json(403, { ok: false, error: "team_mismatch" });
    if (regSite && regSite !== String(siteId)) return json(403, { ok: false, error: "site_mismatch" });
    if (regSub && regSub !== String(subteamId)) return json(403, { ok: false, error: "subteam_mismatch" });

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    // Insert telemetry (public.iot_telemetry_raw)
    const row = {
      team_id: String(teamId),
      site_id: String(siteId),
      subteam_id: String(subteamId),
      device_id: String(deviceId),
      ts: Number(ts),
      ntp_synced: !!body.ntp_synced,
      ok: !!body.ok,
      rssi: typeof body.rssi === "number" ? body.rssi : null,
      ip: body.ip || null,
      client_ip: clientIp,
      sensors: body.sensors || {},
      // received_at is default now() in DB
    };

    const { data: inserted, error: insErr } = await supabase
      .from("iot_telemetry_raw")
      .insert(row)
      .select("id")
      .single();

    if (insErr) {
      return json(500, { ok: false, error: "db_error", stage: "telemetry_insert", message: insErr.message });
    }

    return json(200, { ok: true, id: inserted?.id });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: "server_error",
      message: String(e?.message || e),
      name: e?.name || null,
    });
  }
}