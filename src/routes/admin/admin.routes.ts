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
import {
  createBetaOrder,
  listBetaOrders,
  markBetaOrderShipped,
} from '../../controllers/admin/orders.controller';
import * as crm from '../../controllers/admin/crm.controller';

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

// Pedidos de unidades beta (ver orders.controller.ts)
adminRouter.post('/orders/beta', createBetaOrder);
adminRouter.get('/orders/beta', listBetaOrders);
adminRouter.post('/orders/beta/:id/shipped', markBetaOrderShipped);

// CRM / ERP interno: la web /admin de la landing (ver crm.controller.ts)
adminRouter.get('/crm/customers', crm.listCustomers);
adminRouter.post('/crm/customers', crm.createCustomer);
adminRouter.get('/crm/customers/:id', crm.getCustomer);
adminRouter.patch('/crm/customers/:id', crm.updateCustomer);
adminRouter.post('/crm/customers/:id/events', crm.addCustomerEvent);
adminRouter.delete('/crm/customers/:id/events/:eventId', crm.deleteCustomerEvent);

adminRouter.get('/crm/orders', crm.listOrders);
adminRouter.post('/crm/orders', crm.createOrder);
adminRouter.get('/crm/orders/:id', crm.getOrder);
adminRouter.patch('/crm/orders/:id', crm.updateOrder);
adminRouter.post('/crm/orders/:id/status', crm.setOrderStatus);
adminRouter.post('/crm/sync/beta-orders', crm.syncBetaOrders);

adminRouter.get('/crm/units', crm.listUnits);
adminRouter.post('/crm/units', crm.createUnit);
adminRouter.patch('/crm/units/:id', crm.updateUnit);
adminRouter.post('/crm/units/assign-mac', crm.assignMac);

adminRouter.get('/crm/stock', crm.getStock);
adminRouter.post('/crm/parts', crm.createPart);
adminRouter.patch('/crm/parts/:id', crm.updatePart);
adminRouter.post('/crm/stock/movements', crm.createMovement);
adminRouter.get('/crm/versions', crm.listVersions);
adminRouter.post('/crm/versions', crm.createVersion);
adminRouter.put('/crm/versions/:id/bom', crm.setBom);
