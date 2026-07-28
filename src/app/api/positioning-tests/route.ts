import { collectionRoutes } from '@/lib/api/crud';
import { positioningTestCrud } from '@/lib/api/resources';

export const { GET, POST } = collectionRoutes(positioningTestCrud);
