import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const { method, originalUrl } = req;
  
  // Capture the original res.end function
  const originalEnd = res.end;
  
  // Override res.end to log after response is sent
  res.end = function(this: Response, ...args: any[]): Response {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString();
    
    // Log in a single line format: [timestamp] METHOD /path statusCode duration ms
    console.log(`[${timestamp}] ${method} ${originalUrl} ${res.statusCode} ${duration}ms`);
    
    // Call the original res.end with proper context
    return originalEnd.apply(this, args as any);
  };
  
  next();
};