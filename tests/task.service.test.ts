import { beforeEach, describe, expect, it } from 'vitest';
import { taskService } from '../src/services/task.service';

beforeEach(() => {
  taskService.reset();
});

describe('taskService', () => {
  it('creates tasks with generated ids and timestamps', () => {
    const task = taskService.create({ title: 'Ship it' });

    expect(task.title).toBe('Ship it');
    expect(task.description).toBe('');
    expect(task.completed).toBe(false);
    expect(task.id).toBeTruthy();
    expect(task.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it('lists tasks in creation order', () => {
    taskService.create({ title: 'First' });
    taskService.create({ title: 'Second' });

    const titles = taskService.getAll().map((task) => task.title);

    expect(titles).toEqual(['First', 'Second']);
  });

  it('finds a task by id and returns undefined when missing', () => {
    const created = taskService.create({ title: 'Lookup' });

    expect(taskService.getById(created.id)?.title).toBe('Lookup');
    expect(taskService.getById('nope')).toBeUndefined();
  });

  it('updates only the provided fields', () => {
    const created = taskService.create({ title: 'Before', description: 'Desc' });

    const updated = taskService.update(created.id, { completed: true });

    expect(updated).toMatchObject({
      id: created.id,
      title: 'Before',
      description: 'Desc',
      completed: true,
    });
  });

  it('returns undefined when updating a missing task', () => {
    expect(taskService.update('missing', { title: 'X' })).toBeUndefined();
  });

  it('deletes tasks and reports success', () => {
    const created = taskService.create({ title: 'Temp' });

    expect(taskService.delete(created.id)).toBe(true);
    expect(taskService.delete(created.id)).toBe(false);
    expect(taskService.getAll()).toHaveLength(0);
  });
});
