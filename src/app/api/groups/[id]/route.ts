import { itemRoutes } from '@/lib/api/crud';
import { studentGroupCrud } from '@/lib/api/resources';

export const { GET, PATCH, DELETE } = itemRoutes(studentGroupCrud);
