import { collectionRoutes } from '@/lib/api/crud';
import { trainingCrud } from '@/lib/api/resources';

export const { GET, POST } = collectionRoutes(trainingCrud);
