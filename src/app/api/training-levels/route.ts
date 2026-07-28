import { collectionRoutes } from '@/lib/api/crud';
import { trainingLevelCrud } from '@/lib/api/resources';

export const { GET, POST } = collectionRoutes(trainingLevelCrud);
