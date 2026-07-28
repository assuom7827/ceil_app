import { itemRoutes } from '@/lib/api/crud';
import { specialityCrud } from '@/lib/api/resources';

export const { GET, PATCH, DELETE } = itemRoutes(specialityCrud);
