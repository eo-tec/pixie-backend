import { Router } from 'express';
import { verifyAdminKey, verifyDashboardKey } from '../../middleware/adminAuth';
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

// Pantallas de estadísticas y leads de la landing: van antes del use() para
// que también valga la clave corta del dashboard.
adminRouter.get('/prelaunch/stats', verifyDashboardKey, getStats);
adminRouter.get('/prelaunch/leads', verifyDashboardKey, listLeads);

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
