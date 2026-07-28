import { route } from '@/lib/api/handler';
import { notFoundError } from '@/services/errors';

export const POST = route<{ id: string }>(
  { resource: 'PaymentReceipt', access: 'write' },
  async ({ db, params }) => {
    const receipt = await db.paymentReceipt.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!receipt) throw notFoundError('Reçu introuvable.', { id: params.id });

    return db.paymentReceipt.update({ where: { id: params.id }, data: { state: 'DRAFT' } });
  },
);
