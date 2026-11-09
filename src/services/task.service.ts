import { randomUUID } from 'node:crypto';
import type { CreateTaskInput, Task, UpdateTaskInput } from '../types/task';

class TaskService {
  private readonly tasks = new Map<string, Task>();

  public reset(): void {
    this.tasks.clear();
  }

  public getAll(): Task[] {
    return [...this.tasks.values()];
  }

  public getById(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  public create(input: CreateTaskInput): Task {
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description ?? '',
      completed: input.completed ?? false,
      createdAt: new Date().toISOString(),
    };

    this.tasks.set(task.id, task);
    return task;
  }

  public update(id: string, input: UpdateTaskInput): Task | undefined {
    const existing = this.tasks.get(id);
    if (!existing) {
      return undefined;
    }

    const updated: Task = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.completed !== undefined ? { completed: input.completed } : {}),
    };

    this.tasks.set(id, updated);
    return updated;
  }

  public delete(id: string): boolean {
    return this.tasks.delete(id);
  }
}

export const taskService = new TaskService();
