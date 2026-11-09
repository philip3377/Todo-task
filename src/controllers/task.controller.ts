import type { Request, Response } from 'express';
import { ApiError } from '../middleware/errorHandler';
import { parseCreateTaskBody, parseUpdateTaskBody } from '../middleware/validate';
import { taskService } from '../services/task.service';

function requireTask(id: string) {
  const task = taskService.getById(id);
  if (!task) {
    throw new ApiError(404, `Task with id "${id}" was not found`);
  }
  return task;
}

export function listTasks(_req: Request, res: Response): void {
  res.json(taskService.getAll());
}

export function getTask(req: Request, res: Response): void {
  res.json(requireTask(req.params.id));
}

export function createTask(req: Request, res: Response): void {
  const task = taskService.create(parseCreateTaskBody(req.body));
  res.status(201).json(task);
}

export function updateTask(req: Request, res: Response): void {
  const task = taskService.update(req.params.id, parseUpdateTaskBody(req.body));
  if (!task) {
    throw new ApiError(404, `Task with id "${req.params.id}" was not found`);
  }
  res.json(task);
}

export function deleteTask(req: Request, res: Response): void {
  const deleted = taskService.delete(req.params.id);
  if (!deleted) {
    throw new ApiError(404, `Task with id "${req.params.id}" was not found`);
  }
  res.status(204).send();
}
