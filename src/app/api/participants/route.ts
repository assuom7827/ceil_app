import { NextResponse } from 'next/server';
import { collectionRoutes } from '@/lib/api/crud';
import { readJson, route } from '@/lib/api/handler';
import { participantCrud } from '@/lib/api/resources';
import { participantSchema } from '@/lib/validation/schemas';
import { withTransaction } from '@/services/db';
import { allocateParticipantRegistrationNumber } from '@/services/registration-numbers';

export const { GET } = collectionRoutes(participantCrud);

/**
 * Création avec allocation du matricule.
 * La fabrique générique ne convient pas ici : le matricule doit être réservé
 * dans la même transaction que la création, sous peine de collision.
 */
export const POST = route({ resource: 'Participant', access: 'write' }, async ({ db, request }) => {
  const { categoryIds, ...input } = await readJson(request, participantSchema);

  const created = await withTransaction(db, async (tx) => {
    const registrationNumber = await allocateParticipantRegistrationNumber(tx, input.type);
    return tx.participant.create({
      data: {
        ...input,
        registrationNumber,
        categories: categoryIds?.length
          ? { connect: categoryIds.map((id) => ({ id })) }
          : undefined,
      },
      include: { faculty: true, categories: true },
    });
  });

  return NextResponse.json(created, { status: 201 });
});
