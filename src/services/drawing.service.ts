import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SaveDrawingData {
  pixieId: number;
  userId: string;
  name: string;
  pixels: string[][];
}

export class DrawingService {
  
  async checkUserPermission(userId: string, deviceId: number): Promise<boolean> {
    try {
      // Check if the user owns the device
      const pixie = await prisma.pixie.findFirst({
        where: {
          id: deviceId,
          created_by: parseInt(userId)
        }
      });

      return !!pixie;
    } catch (error) {
      console.error('Error checking user permission:', error);
      return false;
    }
  }

  async getCurrentDrawingState(deviceId: number): Promise<string[][] | null> {
    try {
      // Try to get the latest drawing state from database
      const latestDrawing = await prisma.drawings.findFirst({
        where: {
          pixie_id: deviceId
        },
        orderBy: {
          updated_at: 'desc'
        }
      });

      if (latestDrawing && latestDrawing.pixel_data) {
        // Return the pixel data if it's a valid 64x64 array
        const pixelData = latestDrawing.pixel_data as string[][];
        if (Array.isArray(pixelData) && pixelData.length === 64) {
          return pixelData;
        }
      }

      // Return empty 64x64 black canvas if no drawing found
      return Array(64).fill(null).map(() => Array(64).fill('#000000'));
    } catch (error) {
      console.error('Error getting current drawing state:', error);
      return Array(64).fill(null).map(() => Array(64).fill('#000000'));
    }
  }

  async saveDrawing(data: SaveDrawingData) {
    try {
      const drawing = await prisma.drawings.create({
        data: {
          pixie_id: data.pixieId,
          user_id: data.userId,
          name: data.name,
          pixel_data: data.pixels as any, // Prisma will handle JSON serialization
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      return drawing;
    } catch (error) {
      console.error('Error saving drawing:', error);
      throw error;
    }
  }

  async loadDrawing(drawingId: number) {
    try {
      const drawing = await prisma.drawings.findUnique({
        where: {
          id: drawingId
        }
      });

      return drawing;
    } catch (error) {
      console.error('Error loading drawing:', error);
      throw error;
    }
  }

  async getDrawingsForDevice(deviceId: number) {
    try {
      const drawings = await prisma.drawings.findMany({
        where: {
          pixie_id: deviceId
        },
        orderBy: {
          updated_at: 'desc'
        },
        select: {
          id: true,
          name: true,
          created_at: true,
          updated_at: true,
          user_id: true
        }
      });

      return drawings;
    } catch (error) {
      console.error('Error getting drawings for device:', error);
      throw error;
    }
  }

  async clearDrawingState(deviceId: number) {
    try {
      // Create a new drawing entry with empty canvas
      const emptyPixels = Array(64).fill(null).map(() => Array(64).fill('#000000'));
      
      await this.saveDrawing({
        pixieId: deviceId,
        userId: 'system',
        name: 'Cleared Canvas',
        pixels: emptyPixels
      });

      return true;
    } catch (error) {
      console.error('Error clearing drawing state:', error);
      throw error;
    }
  }

  async updateDrawingState(deviceId: number, pixels: string[][]) {
    try {
      // Find the latest drawing for this device
      const latestDrawing = await prisma.drawings.findFirst({
        where: {
          pixie_id: deviceId
        },
        orderBy: {
          updated_at: 'desc'
        }
      });

      if (latestDrawing) {
        // Update existing drawing
        await prisma.drawings.update({
          where: {
            id: latestDrawing.id
          },
          data: {
            pixel_data: pixels as any,
            updated_at: new Date()
          }
        });
      } else {
        // Create new drawing
        await this.saveDrawing({
          pixieId: deviceId,
          userId: 'system',
          name: 'Auto-saved Drawing',
          pixels
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating drawing state:', error);
      throw error;
    }
  }
}