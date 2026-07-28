import { itemRoutes } from '@/lib/api/crud';
import { teacherCrud } from '@/lib/api/resources';

export const { GET, PATCH, DELETE } = itemRoutes(teacherCrud);
