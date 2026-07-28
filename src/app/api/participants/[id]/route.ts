import { itemRoutes } from '@/lib/api/crud';
import { participantCrud } from '@/lib/api/resources';

export const { GET, PATCH, DELETE } = itemRoutes(participantCrud);
