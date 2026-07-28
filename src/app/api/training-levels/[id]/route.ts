import { itemRoutes } from '@/lib/api/crud';
import { trainingLevelCrud } from '@/lib/api/resources';

export const { GET, PATCH, DELETE } = itemRoutes(trainingLevelCrud);
