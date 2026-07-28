import { itemRoutes } from '@/lib/api/crud';
import { paymentReceiptCrud } from '@/lib/api/resources';

export const { GET, PATCH, DELETE } = itemRoutes(paymentReceiptCrud);
