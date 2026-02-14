export async function GET() {
  return Response.json({ ok: true, route: "/api/iot/ingest" });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  return Response.json({ ok: true, received: body ? true : false });
}