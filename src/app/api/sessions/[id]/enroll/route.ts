import { route, readJson } from '@/lib/api/handler';
import { enrollSchema } from '@/lib/validation/schemas';
import { withTransaction } from '@/services/db';
import { createParticipant, enroll, ACTION_PARTICIPANT_CREATED } from '@/services/enrollment';
import { logAudit } from '@/services/audit';

/**
 * Inscription simplifiée — une seule requête pour le dialogue :
 * participants existants sélectionnés ET participants créés à la volée.
 * Le tout dans une transaction : soit tout est inscrit, soit rien ne l'est.
 */
export const POST = route<{ id: string }>(
  { resource: 'Enrollment', access: 'write' },
  async ({ db, params, request, actor }) => {
    const input = await readJson(request, enrollSchema);

    return withTransaction(db, async (tx) => {
      const createdIds: string[] = [];

      for (const draft of input.newParticipants) {
        const participant = await createParticipant(tx, draft);
        createdIds.push(participant.id);

        await logAudit(tx, {
          actorId: actor.id,
          action: ACTION_PARTICIPANT_CREATED,
          entityType: 'Participant',
          entityId: participant.id,
          newValue: {
            familyName: participant.familyName,
            firstName: participant.firstName,
            registrationNumber: participant.registrationNumber,
          },
        });
      }

      const result = await enroll(tx, params.id, [...input.participantIds, ...createdIds], {
        kind: input.kind,
        responsible: input.responsible,
        actorId: actor.id,
      });

      return { ...result, participantsCreated: createdIds.length };
    });
  },
);
