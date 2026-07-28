import { itemRoutes } from '@/lib/api/crud';
import { positioningTestCrud } from '@/lib/api/resources';

export const { GET, PATCH, DELETE } = itemRoutes(positioningTestCrud);
