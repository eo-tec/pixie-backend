export interface DrawingCommand {
  action: 'draw_pixel' | 'draw_stroke' | 'clear_canvas';
  x?: number;
  y?: number;
  color?: string;
  tool?: 'draw' | 'erase';
  size?: number; // Brush size for draw_pixel
  points?: Array<{x: number, y: number}>;
  userId?: string;
}

export interface DrawingSession {
  deviceId: number;
  participants: Set<string>;
  lastActivity: number;
  drawingBuffer: string[][];
}

export interface DrawingPixel {
  x: number;
  y: number;
  color: string;
}

export interface DrawingState {
  pixels: string[][];
  lastUpdated: number;
}

export interface UserDrawingEvent {
  userId: string;
  username?: string;
  action: string;
  timestamp: number;
}