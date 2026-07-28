import { collectionRoutes } from '@/lib/api/crud';
import { teacherCrud } from '@/lib/api/resources';

export const { GET, POST } = collectionRoutes(teacherCrud);
