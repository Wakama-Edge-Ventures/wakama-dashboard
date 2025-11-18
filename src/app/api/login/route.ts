import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({} as any));

  const expectedUser = process.env.AMIRA_DASH_USER;
  const expectedPass = process.env.AMIRA_DASH_PASSWORD;

  const ok =
    username === expectedUser &&
    password === expectedPass &&
    !!expectedUser &&
    !!expectedPass;

  // tracking simple: log dans la console (Vercel ou local)
  const ip =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';

  console.log(
    `[LOGIN] user=${username || ''} ok=${ok} ip=${ip} ts=${new Date().toISOString()}`
  );

  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });

  // cookie httpOnly pour protéger /now-playing
  res.cookies.set('wakama_auth', 'ok', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 6, // 6 heures
  });

  return res;
}
