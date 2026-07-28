import { collectionRoutes } from '@/lib/api/crud';
import { studentGroupCrud } from '@/lib/api/resources';

export const { GET, POST } = collectionRoutes(studentGroupCrud);
