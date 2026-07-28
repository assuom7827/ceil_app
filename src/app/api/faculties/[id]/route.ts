import { itemRoutes } from '@/lib/api/crud';
import { facultyCrud } from '@/lib/api/resources';

export const { GET, PATCH, DELETE } = itemRoutes(facultyCrud);
