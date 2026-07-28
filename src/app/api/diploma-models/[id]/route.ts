import { itemRoutes } from '@/lib/api/crud';
import { diplomaModelCrud } from '@/lib/api/resources';

export const { GET, PATCH, DELETE } = itemRoutes(diplomaModelCrud);
