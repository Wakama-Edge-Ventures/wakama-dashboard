// src/app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';

type LoginBody = {
  email: string;
  password: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as LoginBody;
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: 'Missing credentials' },
      { status: 400 },
    );
  }

  // Stub simple (à brancher plus tard avec une vraie auth)
  return NextResponse.json({ ok: true });
}
