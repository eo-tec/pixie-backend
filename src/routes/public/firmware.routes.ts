import { Router } from 'express';
import { getFirmwareManifest } from '../../controllers/pixie/firmware.controller';

export const firmwareRouter = Router();

firmwareRouter.get('/manifest', getFirmwareManifest);
