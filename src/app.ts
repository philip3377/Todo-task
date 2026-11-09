import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp(): express.Express {
  const application = express();

  application.use(helmet());
  application.use(express.json({ limit: '16kb' }));
  application.use(express.static(path.join(__dirname, '..', 'public')));
  application.use('/api', apiRouter);
  application.use(notFoundHandler);
  application.use(errorHandler);

  return application;
}
