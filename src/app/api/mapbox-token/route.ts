import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const token =
    process.env.MAPBOX_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    '';

  // on renvoie juste le token (c’est un token public de toute façon)
  return NextResponse.json({ token });
}