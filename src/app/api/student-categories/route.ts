import { collectionRoutes } from '@/lib/api/crud';
import { studentCategoryCrud } from '@/lib/api/resources';

export const { GET, POST } = collectionRoutes(studentCategoryCrud);
