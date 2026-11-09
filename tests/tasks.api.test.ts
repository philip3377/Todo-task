import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { taskService } from '../src/services/task.service';

const app = createApp();

beforeEach(() => {
  taskService.reset();
});

describe('GET /api/health', () => {
  it('returns status ok', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptime).toBe('number');
    expect(typeof response.body.timestamp).toBe('string');
  });
});

describe('POST /api/tasks', () => {
  it('creates a task with defaults', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Write CI pipeline' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      title: 'Write CI pipeline',
      description: '',
      completed: false,
    });
    expect(typeof response.body.id).toBe('string');
    expect(typeof response.body.createdAt).toBe('string');
  });

  it('trims whitespace from fields', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: '  Padded title  ', description: '  Some description  ' });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Padded title');
    expect(response.body.description).toBe('Some description');
  });

  it('drops unknown fields', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Safe task', isAdmin: true });

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty('isAdmin');
  });

  it('rejects a missing title', async () => {
    const response = await request(app).post('/api/tasks').send({});

    expect(response.status).toBe(400);
    expect(response.body.error.status).toBe(400);
  });

  it('rejects an empty title', async () => {
    const response = await request(app).post('/api/tasks').send({ title: '   ' });

    expect(response.status).toBe(400);
  });

  it('rejects a non-boolean completed value', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Broken', completed: 'yes' });

    expect(response.status).toBe(400);
  });

  it('rejects malformed JSON bodies', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title": broken');

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });
});

describe('GET /api/tasks', () => {
  it('returns an empty array when no tasks exist', async () => {
    const response = await request(app).get('/api/tasks');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('returns all created tasks', async () => {
    taskService.create({ title: 'Task one' });
    taskService.create({ title: 'Task two' });

    const response = await request(app).get('/api/tasks');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((task: { title: string }) => task.title)).toEqual([
      'Task one',
      'Task two',
    ]);
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns a task by id', async () => {
    const created = taskService.create({ title: 'Find me' });

    const response = await request(app).get(`/api/tasks/${created.id}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(created.id);
  });

  it('returns 404 for an unknown id', async () => {
    const response = await request(app).get('/api/tasks/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.status).toBe(404);
    expect(response.body.error.message).toContain('does-not-exist');
  });
});

describe('PUT /api/tasks/:id', () => {
  it('updates title and completed flag', async () => {
    const created = taskService.create({ title: 'Original' });

    const response = await request(app)
      .put(`/api/tasks/${created.id}`)
      .send({ title: 'Updated', completed: true });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: created.id,
      title: 'Updated',
      completed: true,
      description: '',
    });
  });

  it('keeps createdAt unchanged', async () => {
    const created = taskService.create({ title: 'Original' });

    const response = await request(app)
      .put(`/api/tasks/${created.id}`)
      .send({ completed: true });

    expect(response.status).toBe(200);
    expect(response.body.createdAt).toBe(created.createdAt);
  });

  it('returns 404 for an unknown id', async () => {
    const response = await request(app).put('/api/tasks/missing').send({ title: 'X' });

    expect(response.status).toBe(404);
  });

  it('rejects an empty update body', async () => {
    const created = taskService.create({ title: 'Original' });

    const response = await request(app).put(`/api/tasks/${created.id}`).send({});

    expect(response.status).toBe(400);
  });

  it('rejects update bodies containing only unknown fields', async () => {
    const created = taskService.create({ title: 'Original' });

    const response = await request(app)
      .put(`/api/tasks/${created.id}`)
      .send({ isAdmin: true });

    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes a task and returns 204', async () => {
    const created = taskService.create({ title: 'Delete me' });

    const response = await request(app).delete(`/api/tasks/${created.id}`);

    expect(response.status).toBe(204);
    expect(taskService.getById(created.id)).toBeUndefined();
  });

  it('returns 404 for an unknown id', async () => {
    const response = await request(app).delete('/api/tasks/missing');

    expect(response.status).toBe(404);
  });
});

describe('web UI (monolith)', () => {
  it('serves the UI at the root path', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('TaskFlow');
  });

  it('serves the stylesheet', async () => {
    const response = await request(app).get('/styles.css');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/css');
  });

  it('serves the client script', async () => {
    const response = await request(app).get('/app.js');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('javascript');
  });
});

describe('unknown routes', () => {
  it('returns 404 JSON for unknown API routes', async () => {
    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.status).toBe(404);
  });

  it('returns 404 JSON for unknown routes outside the API', async () => {
    const response = await request(app).get('/nowhere');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
  });
});
