import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import { taskRouter } from './task.routes';

export const apiRouter = Router();

apiRouter.get('/health', getHealth);
apiRouter.use('/tasks', taskRouter);
