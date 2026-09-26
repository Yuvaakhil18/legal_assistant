import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { requestIdMiddleware } from './middleware/requestId.js';
import { disclaimerMiddleware } from './middleware/disclaimer.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import documentRoutes from './routes/documentRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import { logger } from './utils/logger.js';

export function createApp(): Express {
  const app = express();

  // 1. Security & Core Middleware
  app.use(helmet({
    contentSecurityPolicy: false // Allow modern frontend communication
  }));
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // 2. Request Correlation & Regulatory Headers
  app.use(requestIdMiddleware);
  app.use(disclaimerMiddleware);

  // 3. Request Logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info(`${req.method} ${req.path} ${res.statusCode}`, {
        requestId: req.requestId,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        latencyMs: Date.now() - start
      });
    });
    next();
  });

  // 4. API Routes
  app.use('/api', healthRouter);
  app.use('/api/documents', documentRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/', healthRouter); // Mount on root as well for default health probes

  // 5. 404 Catch-All Handler
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(404, 'DOCUMENT_NOT_FOUND', `Route not found: ${req.method} ${req.path}`));
  });

  // 6. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
