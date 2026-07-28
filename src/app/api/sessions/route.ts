import { collectionRoutes } from '@/lib/api/crud';
import { trainingSessionCrud } from '@/lib/api/resources';

export const { GET, POST } = collectionRoutes(trainingSessionCrud);
