import { collectionRoutes } from '@/lib/api/crud';
import { specialityCrud } from '@/lib/api/resources';

export const { GET, POST } = collectionRoutes(specialityCrud);
