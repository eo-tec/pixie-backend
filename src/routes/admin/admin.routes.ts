import { Router } from 'express';
import { verifyAdminKey } from '../../middleware/adminAuth';
import { provisionFrame } from '../../controllers/admin/provision.controller';

export const adminRouter = Router();

adminRouter.use(verifyAdminKey);

adminRouter.post('/frames/provision', provisionFrame);
