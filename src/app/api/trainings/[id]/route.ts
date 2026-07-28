import { itemRoutes } from '@/lib/api/crud';
import { trainingCrud } from '@/lib/api/resources';

export const { GET, PATCH, DELETE } = itemRoutes(trainingCrud);
