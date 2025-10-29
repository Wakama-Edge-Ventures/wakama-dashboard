
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const p = path.join(process.cwd(), 'public', 'now.json');

  try {
    const raw = await fs.readFile(p, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e: any) {
    // Erreur explicite pour debug (visible dans logs Vercel & terminal local)
    return NextResponse.json(
      { error: 'NOW_SNAPSHOT_READ_FAILED', detail: String(e?.message || e) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
