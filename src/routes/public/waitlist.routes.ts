import { Router } from 'express';
import { addToWaitlist } from '../../controllers/waitlist/waitlist.controller';

export const waitlistRouter = Router();

waitlistRouter.post('/', addToWaitlist);
