// src/app/api/now/route.ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

type Totals = { files: number; cids: number; onchainTx: number; lastTs: string };
type NowItem = {
  cid: string;
  tx?: string;
  file?: string;
  sha256?: string;
  ts?: string;
  status?: string;
  slot?: number | null;
  source?: string;
};
type Now = { totals: Totals; items: NowItem[] };

const EMPTY: Now = {
  totals: { files: 0, cids: 0, onchainTx: 0, lastTs: '—' },
  items: [],
};

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'now.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Now;
    return NextResponse.json(parsed);
  } catch {
    // Fallback si le fichier n’existe pas encore
    return NextResponse.json(EMPTY);
  }
}
