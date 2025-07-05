import { Router } from 'express';
import { 
  startDrawingSession, 
  endDrawingSession, 
  saveDrawing, 
  loadDrawing, 
  getDrawings, 
  clearDrawing 
} from '../../controllers/drawing/drawing.controller';

export const drawingRouter = Router();

// Start drawing session for a device
drawingRouter.post('/pixie/:pixieId/draw/start', startDrawingSession);

// End drawing session for a device
drawingRouter.post('/pixie/:pixieId/draw/end', endDrawingSession);

// Save current drawing
drawingRouter.post('/pixie/:pixieId/draw/save', saveDrawing);

// Load saved drawing
drawingRouter.get('/pixie/:pixieId/draw/:drawingId', loadDrawing);

// Get all drawings for a device
drawingRouter.get('/pixie/:pixieId/draw', getDrawings);

// Clear drawing canvas
drawingRouter.post('/pixie/:pixieId/draw/clear', clearDrawing);