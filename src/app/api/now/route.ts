import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const p = path.join(process.cwd(), 'public/now.json');
  let data = { totals: { files: 0, cids: 0, onchainTx: 0, lastTs: '—' }, items: [] as any[] };
  try { data = JSON.parse(await fs.readFile(p, 'utf-8')); } catch {}
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
