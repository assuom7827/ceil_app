import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Sonde de disponibilité (utilisée par docker/CI et les tests e2e). */
export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ceil-app',
    timestamp: new Date().toISOString(),
  });
}
