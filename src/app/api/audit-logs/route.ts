import { route } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';

export const GET = route(
  { resource: 'AuditLog', access: 'read' },
  async ({ url }) => {
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('perPage') ?? '20')));
    const entityType = url.searchParams.get('entityType') ?? undefined;
    const entityId = url.searchParams.get('entityId') ?? undefined;
    const actorId = url.searchParams.get('actorId') ?? undefined;

    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (actorId) where.actorId = actorId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          actorId: true,
          action: true,
          entityType: true,
          entityId: true,
          oldValue: true,
          newValue: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  },
);
