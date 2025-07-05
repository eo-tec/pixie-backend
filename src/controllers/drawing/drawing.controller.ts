import { Response } from 'express';
import { AuthenticatedRequest } from '../../routes/private/checkUser';
import { enterDrawingMode, exitDrawingMode } from '../../mqtt/drawing.mqtt';
import { DrawingService } from '../../services/drawing.service';

const drawingService = new DrawingService();

// Start drawing session for a device
export const startDrawingSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pixieId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!pixieId) {
      res.status(400).json({ error: 'Device ID is required' });
      return;
    }

    const deviceId = parseInt(pixieId);
    
    // Check if user owns the device or has permission
    const hasPermission = await drawingService.checkUserPermission(userId!.toString(), deviceId);
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Enter drawing mode on the device
    await enterDrawingMode(deviceId);

    // Get current drawing state if exists
    const currentState = await drawingService.getCurrentDrawingState(deviceId);

    res.json({
      success: true,
      message: 'Drawing session started',
      deviceId,
      currentState
    });

  } catch (error) {
    console.error('Error starting drawing session:', error);
    res.status(500).json({ error: 'Failed to start drawing session' });
  }
};

// End drawing session for a device
export const endDrawingSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pixieId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
    }

    if (!pixieId) {
      res.status(400).json({ error: 'Device ID is required' });
      return;
    }

    const deviceId = parseInt(pixieId);

    // Check if user owns the device or has permission
    const hasPermission = await drawingService.checkUserPermission(userId!.toString(), deviceId);
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Exit drawing mode on the device
    await exitDrawingMode(deviceId);

    res.json({
      success: true,
      message: 'Drawing session ended',
      deviceId
    });

  } catch (error) {
    console.error('Error ending drawing session:', error);
    res.status(500).json({ error: 'Failed to end drawing session' });
  }
};

// Save current drawing
export const saveDrawing = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pixieId } = req.params;
    const { name, pixels } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
    }

    if (!pixieId || !pixels) {
      res.status(400).json({ error: 'Device ID and pixels are required' });
      return;
    }

    const deviceId = parseInt(pixieId);

    // Check if user owns the device or has permission
    const hasPermission = await drawingService.checkUserPermission(userId!.toString(), deviceId);
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Save the drawing
    const drawing = await drawingService.saveDrawing({
      pixieId: deviceId,
      userId: userId!.toString(),
      name: name || `Drawing ${new Date().toISOString()}`,
      pixels
    });

    res.json({
      success: true,
      message: 'Drawing saved',
      drawing
    });

  } catch (error) {
    console.error('Error saving drawing:', error);
    res.status(500).json({ error: 'Failed to save drawing' });
  }
};

// Load saved drawing
export const loadDrawing = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pixieId, drawingId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
    }

    if (!pixieId || !drawingId) {
      res.status(400).json({ error: 'Device ID and Drawing ID are required' });
      return;
    }

    const deviceId = parseInt(pixieId);

    // Check if user owns the device or has permission
    const hasPermission = await drawingService.checkUserPermission(userId!.toString(), deviceId);
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Load the drawing
    const drawing = await drawingService.loadDrawing(parseInt(drawingId));
    
    if (!drawing) {
      res.status(404).json({ error: 'Drawing not found' });
      return;
    }

    res.json({
      success: true,
      drawing
    });

  } catch (error) {
    console.error('Error loading drawing:', error);
    res.status(500).json({ error: 'Failed to load drawing' });
  }
};

// Get all drawings for a device
export const getDrawings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pixieId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
    }

    if (!pixieId) {
      res.status(400).json({ error: 'Device ID is required' });
      return;
    }

    const deviceId = parseInt(pixieId);

    // Check if user owns the device or has permission
    const hasPermission = await drawingService.checkUserPermission(userId!.toString(), deviceId);
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Get all drawings for the device
    const drawings = await drawingService.getDrawingsForDevice(deviceId);

    res.json({
      success: true,
      drawings
    });

  } catch (error) {
    console.error('Error getting drawings:', error);
    res.status(500).json({ error: 'Failed to get drawings' });
  }
};

// Clear drawing canvas
export const clearDrawing = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pixieId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
    }

    if (!pixieId) {
      res.status(400).json({ error: 'Device ID is required' });
      return;
    }

    const deviceId = parseInt(pixieId);

    // Check if user owns the device or has permission
    const hasPermission = await drawingService.checkUserPermission(userId!.toString(), deviceId);
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Clear the current drawing state
    await drawingService.clearDrawingState(deviceId);

    res.json({
      success: true,
      message: 'Drawing cleared',
      deviceId
    });

  } catch (error) {
    console.error('Error clearing drawing:', error);
    res.status(500).json({ error: 'Failed to clear drawing' });
  }
};