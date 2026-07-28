import { collectionRoutes } from '@/lib/api/crud';
import { diplomaModelCrud } from '@/lib/api/resources';

export const { GET, POST } = collectionRoutes(diplomaModelCrud);
