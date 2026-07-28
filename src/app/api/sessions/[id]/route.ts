import { itemRoutes } from '@/lib/api/crud';
import { trainingSessionCrud } from '@/lib/api/resources';

export const { GET, PATCH, DELETE } = itemRoutes(trainingSessionCrud);
