import { publishToMQTT } from './client';
import { DrawingCommand } from '../types/drawing.types';

export const publishDrawingCommand = async (deviceId: number, command: DrawingCommand): Promise<void> => {
  try {
    const topic = `pixie/${deviceId}`;
    
    // Convert RGB hex to RGB565 for ESP32
    let rgb565Color: number | undefined;
    if (command.color) {
      rgb565Color = hexToRgb565(command.color);
    }

    let message;
    
    switch (command.action) {
      case 'draw_pixel':
        message = {
          action: 'draw_pixel',
          x: command.x,
          y: command.y,
          color: command.color, // Send hex color instead of RGB565
          tool: command.tool,
          size: command.size || 1, // Include brush size, default to 1
          userId: command.userId
        };
        break;

      case 'draw_stroke':
        message = {
          action: 'draw_stroke',
          points: command.points,
          color: command.color, // Send hex color instead of RGB565
          tool: command.tool,
          userId: command.userId
        };
        break;

      case 'clear_canvas':
        message = {
          action: 'clear_canvas',
          userId: command.userId
        };
        break;

      default:
        console.error('Unknown drawing command:', command.action);
        return;
    }

    await publishToMQTT(topic, JSON.stringify(message));
    console.log(`Published drawing command to ${topic}:`, message);
    
  } catch (error) {
    console.error('Error publishing drawing command:', error);
    throw error;
  }
};

// Convert hex color to RGB565 format for ESP32
function hexToRgb565(hex: string): number {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Convert to RGB565 format (5 bits red, 6 bits green, 5 bits blue)
  const r5 = (r >> 3) & 0x1F;
  const g6 = (g >> 2) & 0x3F;
  const b5 = (b >> 3) & 0x1F;
  
  return (r5 << 11) | (g6 << 5) | b5;
}

// Convert RGB565 to hex color (for debugging)
export function rgb565ToHex(rgb565: number): string {
  const r = ((rgb565 >> 11) & 0x1F) << 3;
  const g = ((rgb565 >> 5) & 0x3F) << 2;
  const b = (rgb565 & 0x1F) << 3;
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Enter drawing mode command
export const enterDrawingMode = async (deviceId: number): Promise<void> => {
  try {
    const topic = `pixie/${deviceId}`;
    const message = {
      action: 'enter_draw_mode'
    };
    
    await publishToMQTT(topic, JSON.stringify(message));
    console.log(`Entered drawing mode for device ${deviceId}`);
    
  } catch (error) {
    console.error('Error entering drawing mode:', error);
    throw error;
  }
};

// Exit drawing mode command
export const exitDrawingMode = async (deviceId: number): Promise<void> => {
  try {
    const topic = `pixie/${deviceId}`;
    const message = {
      action: 'exit_draw_mode'
    };
    
    await publishToMQTT(topic, JSON.stringify(message));
    console.log(`Exited drawing mode for device ${deviceId}`);
    
  } catch (error) {
    console.error('Error exiting drawing mode:', error);
    throw error;
  }
};