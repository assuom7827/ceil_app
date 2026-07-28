import { itemRoutes } from '@/lib/api/crud';
import { studentCategoryCrud } from '@/lib/api/resources';

export const { GET, PATCH, DELETE } = itemRoutes(studentCategoryCrud);
