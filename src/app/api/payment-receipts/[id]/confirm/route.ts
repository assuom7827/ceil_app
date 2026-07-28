import { route } from '@/lib/api/handler';
import { conflictError, notFoundError } from '@/services/errors';

/** Confirme un reçu. Un reçu déjà confirmé n'est pas re-confirmé (409). */
export const POST = route<{ id: string }>(
  { resource: 'PaymentReceipt', access: 'write' },
  async ({ db, params }) => {
    const receipt = await db.paymentReceipt.findUnique({
      where: { id: params.id },
      select: { state: true },
    });
    if (!receipt) throw notFoundError('Reçu introuvable.', { id: params.id });
    if (receipt.state === 'CONFIRMED') {
      throw conflictError('Ce reçu est déjà confirmé.', { id: params.id });
    }

    return db.paymentReceipt.update({
      where: { id: params.id },
      data: { state: 'CONFIRMED', paymentDate: new Date() },
    });
  },
);
