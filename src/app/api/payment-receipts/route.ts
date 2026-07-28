import { NextResponse } from 'next/server';
import { collectionRoutes } from '@/lib/api/crud';
import { readJson, route } from '@/lib/api/handler';
import { paymentReceiptCrud } from '@/lib/api/resources';
import { paymentReceiptSchema } from '@/lib/validation/schemas';
import { withTransaction } from '@/services/db';
import { allocateReceiptNumber } from '@/services/registration-numbers';

export const { GET } = collectionRoutes(paymentReceiptCrud);

/** Création avec allocation transactionnelle du numéro `PAY-{YYYY}-{n}`. */
export const POST = route(
  { resource: 'PaymentReceipt', access: 'write' },
  async ({ db, request }) => {
    const input = await readJson(request, paymentReceiptSchema);

    const created = await withTransaction(db, async (tx) => {
      const year = (input.paymentDate ?? new Date()).getFullYear();
      return tx.paymentReceipt.create({
        data: { ...input, receiptNumber: await allocateReceiptNumber(tx, year) },
        include: { participant: true, trainingSession: true },
      });
    });

    return NextResponse.json(created, { status: 201 });
  },
);
