import { collectionRoutes } from '@/lib/api/crud';
import { facultyCrud } from '@/lib/api/resources';

export const { GET, POST } = collectionRoutes(facultyCrud);
