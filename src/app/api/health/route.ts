import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type HealthStatus = 'ok' | 'degraded' | 'error';
type HealthCheck = { status: HealthStatus; detail?: string; durationMs?: number };

async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<{ label: string; result: T; error: Error | null; durationMs: number }> {
  const start = Date.now();
  try {
    const result = await fn();
    return { label, result, error: null, durationMs: Date.now() - start };
  } catch (error) {
    return { label, result: undefined as T, error: error instanceof Error ? error : new Error(String(error)), durationMs: Date.now() - start };
  }
}

async function checkPrisma(): Promise<HealthCheck> {
  const { error, durationMs } = await withTiming('prisma', async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  if (error) {
    return { status: 'error', detail: error.message, durationMs };
  }
  return { status: 'ok', detail: 'database reachable', durationMs };
}

async function checkLibreOffice(): Promise<HealthCheck> {
  const { result, error, durationMs } = await withTiming<string | null>('libreoffice', async () => {
    const { libreOfficeVersion } = await import('@/services/odt-render');
    return await libreOfficeVersion();
  });

  if (error) {
    return { status: 'degraded', detail: 'LibreOffice unreachable', durationMs };
  }
  if (!result) {
    return { status: 'degraded', detail: 'LibreOffice not installed', durationMs };
  }
  return { status: 'ok', detail: result, durationMs };
}

function summarize(checks: Record<string, HealthCheck>): HealthStatus {
  const values = Object.values(checks);
  if (values.some((c) => c.status === 'error')) return 'error';
  if (values.some((c) => c.status === 'degraded')) return 'degraded';
  return 'ok';
}

/**
 * GET /api/health
 *
 * Sans paramètre : liveness — l'application répond (toujours 200).
 * Avec `?probe=readiness` : readiness — dépendances critiques vérifiées.
 * Avec `?probe=full` : toutes les dépendances, y compris optionnelles.
 *
 * Utilisable par Kubernetes (liveness / readiness probes), un load-balancer
 * ou un reverse proxy.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const probe = url.searchParams.get('probe') ?? 'liveness';

  const checks: Record<string, HealthCheck> = {
    app: { status: 'ok', detail: 'application running' },
  };

  if (probe === 'readiness' || probe === 'full') {
    checks.database = await checkPrisma();
    if (checks.database.status === 'error') {
      checks.database.detail = 'database unreachable';
    }
  }

  if (probe === 'full') {
    checks.libreoffice = await checkLibreOffice();
  }

  const status = probe === 'liveness' ? 'ok' : summarize(checks);

  return NextResponse.json(
    {
      status,
      probe,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: status === 'ok' ? 200 : status === 'degraded' ? 503 : 500 },
  );
}
