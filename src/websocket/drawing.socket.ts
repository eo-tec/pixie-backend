import { Server, Socket } from 'socket.io';
import { supabase } from '../config';
import prisma from '../services/prisma';
import { publishDrawingCommand } from '../mqtt/drawing.mqtt';
import { DrawingCommand, DrawingSession } from '../types/drawing.types';
import { rateLimiter } from '../utils/rate-limiter';

// Store active drawing sessions
const activeSessions = new Map<number, DrawingSession>();

export const initDrawingSocket = (io: Server) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('No token provided'));
      }

      // Verify token with Supabase
      const { data: user, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return next(new Error('Invalid token'));
      }

      // Get user from our database
      const publicUser = await prisma.public_users.findFirst({
        where: {
          user_id: user.user?.id,
        }
      });

      if (!publicUser) {
        return next(new Error('User not found in database'));
      }

      socket.data.user = {
        id: publicUser.id,
        username: publicUser.username,
        supabaseId: user.user?.id
      };
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`User ${socket.data.user.id} connected to drawing socket`);

    // Join device room for drawing
    socket.on('join_device', (deviceId: number) => {
      const roomName = `device_${deviceId}`;
      socket.join(roomName);
      
      // Create or update drawing session
      if (!activeSessions.has(deviceId)) {
        activeSessions.set(deviceId, {
          deviceId,
          participants: new Set(),
          lastActivity: Date.now(),
          drawingBuffer: Array(64).fill(null).map(() => Array(64).fill('#000000'))
        });
      }

      const session = activeSessions.get(deviceId)!;
      session.participants.add(socket.data.user.id);
      session.lastActivity = Date.now();

      console.log(`User ${socket.data.user.id} joined device ${deviceId} room`);
      
      // Send current drawing state to the new user
      socket.emit('drawing_state', {
        pixels: session.drawingBuffer
      });

      // Notify other users in the room
      socket.to(roomName).emit('user_joined', {
        userId: socket.data.user.id,
        username: socket.data.user.username
      });
    });

    // Handle drawing commands
    socket.on('draw_pixel', async (data: DrawingCommand & { deviceId: number }) => {
      try {
        // Rate limiting: max 60 commands per second per user
        if (!rateLimiter.consume(socket.data.user.id, 'draw_pixel')) {
          socket.emit('error', { message: 'Rate limit exceeded' });
          return;
        }

        const { deviceId, x, y, color, tool } = data;
        
        // Validate coordinates
        if (x === undefined || y === undefined || x < 0 || x >= 64 || y < 0 || y >= 64) {
          socket.emit('error', { message: 'Invalid coordinates' });
          return;
        }

        // Validate color format
        if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
          socket.emit('error', { message: 'Invalid color format' });
          return;
        }

        const roomName = `device_${deviceId}`;
        const session = activeSessions.get(deviceId);
        
        if (!session) {
          socket.emit('error', { message: 'Drawing session not found' });
          return;
        }

        // Update drawing buffer
        const finalColor = tool === 'erase' ? '#000000' : color;
        if (session.drawingBuffer[y]) {
          session.drawingBuffer[y][x] = finalColor;
        }
        session.lastActivity = Date.now();

        // Broadcast to other users in the room
        socket.to(roomName).emit('draw_pixel', {
          x,
          y,
          color: finalColor,
          tool,
          userId: socket.data.user.id
        });

        // Send to ESP32 via MQTT
        await publishDrawingCommand(deviceId, {
          action: 'draw_pixel',
          x,
          y,
          color: finalColor,
          tool,
          userId: socket.data.user.id
        });

      } catch (error) {
        console.error('Error handling draw_pixel:', error);
        socket.emit('error', { message: 'Failed to process drawing command' });
      }
    });

    // Handle canvas clear
    socket.on('clear_canvas', async (data: { deviceId: number }) => {
      try {
        const { deviceId } = data;
        const roomName = `device_${deviceId}`;
        const session = activeSessions.get(deviceId);
        
        if (!session) {
          socket.emit('error', { message: 'Drawing session not found' });
          return;
        }

        // Clear drawing buffer
        session.drawingBuffer = Array(64).fill(null).map(() => Array(64).fill('#000000'));
        session.lastActivity = Date.now();

        // Broadcast to all users in the room
        io.to(roomName).emit('canvas_cleared', {
          userId: socket.data.user.id
        });

        // Send to ESP32 via MQTT
        await publishDrawingCommand(deviceId, {
          action: 'clear_canvas',
          userId: socket.data.user.id
        });

      } catch (error) {
        console.error('Error handling clear_canvas:', error);
        socket.emit('error', { message: 'Failed to clear canvas' });
      }
    });

    // Handle drawing stroke (for smoother drawing)
    socket.on('draw_stroke', async (data: { deviceId: number; points: Array<{x: number, y: number}>, color: string, tool: string }) => {
      try {
        // Rate limiting: max 30 strokes per second per user
        if (!rateLimiter.consume(socket.data.user.id, 'draw_stroke')) {
          socket.emit('error', { message: 'Rate limit exceeded' });
          return;
        }

        const { deviceId, points, color, tool } = data;
        const roomName = `device_${deviceId}`;
        const session = activeSessions.get(deviceId);
        
        if (!session) {
          socket.emit('error', { message: 'Drawing session not found' });
          return;
        }

        // Update drawing buffer for all points
        const finalColor = tool === 'erase' ? '#000000' : color;
        points.forEach(point => {
          if (point.x >= 0 && point.x < 64 && point.y >= 0 && point.y < 64 && session.drawingBuffer[point.y]) {
            session.drawingBuffer[point.y][point.x] = finalColor;
          }
        });
        session.lastActivity = Date.now();

        // Broadcast to other users in the room
        socket.to(roomName).emit('draw_stroke', {
          points,
          color: finalColor,
          tool,
          userId: socket.data.user.id
        });

        // Send to ESP32 via MQTT
        await publishDrawingCommand(deviceId, {
          action: 'draw_stroke',
          points,
          color: finalColor,
          tool: tool as 'draw' | 'erase',
          userId: socket.data.user.id
        });

      } catch (error) {
        console.error('Error handling draw_stroke:', error);
        socket.emit('error', { message: 'Failed to process drawing stroke' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${socket.data.user.id} disconnected from drawing socket`);
      
      // Remove user from all sessions
      activeSessions.forEach((session, deviceId) => {
        if (session.participants.has(socket.data.user.id)) {
          session.participants.delete(socket.data.user.id);
          
          // Notify other users in the room
          socket.to(`device_${deviceId}`).emit('user_left', {
            userId: socket.data.user.id,
            username: socket.data.user.username
          });
          
          // Clean up empty sessions
          if (session.participants.size === 0) {
            activeSessions.delete(deviceId);
          }
        }
      });
    });
  });

  // Clean up inactive sessions every 5 minutes
  setInterval(() => {
    const now = Date.now();
    const INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    activeSessions.forEach((session, deviceId) => {
      if (now - session.lastActivity > INACTIVE_TIMEOUT) {
        console.log(`Cleaning up inactive session for device ${deviceId}`);
        activeSessions.delete(deviceId);
      }
    });
  }, 60000); // Check every minute

  console.log('Drawing WebSocket server initialized');
};