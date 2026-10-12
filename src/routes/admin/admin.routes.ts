import { Router } from 'express';
import { verifyAdminKey } from '../../middleware/adminAuth';
import { provisionFrame } from '../../controllers/admin/provision.controller';
import {
  recordVisit,
  createLead,
  markStep,
  saveSurvey,
  saveExitSurvey,
  recordReservation,
  recordRefund,
  getStats,
  listLeads,
} from '../../controllers/admin/prelaunch.controller';

export const adminRouter = Router();

adminRouter.use(verifyAdminKey);

adminRouter.post('/frames/provision', provisionFrame);

// Validación tipo Prelaunch de la landing (ver prelaunch.controller.ts)
adminRouter.post('/prelaunch/visit', recordVisit);
adminRouter.post('/prelaunch/lead', createLead);
adminRouter.post('/prelaunch/step', markStep);
adminRouter.post('/prelaunch/survey', saveSurvey);
adminRouter.post('/prelaunch/exit', saveExitSurvey);
adminRouter.post('/prelaunch/reservation', recordReservation);
adminRouter.post('/prelaunch/refund', recordRefund);
adminRouter.get('/prelaunch/stats', getStats);
adminRouter.get('/prelaunch/leads', listLeads);
