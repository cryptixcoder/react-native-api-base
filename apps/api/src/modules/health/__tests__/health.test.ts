import request from 'supertest';
import { mockPrisma, prismaMock } from '@/test/prisma-mock.js';

mockPrisma();

const { createApp } = await import('@/app.js');

describe('health', () => {
  it('returns liveness with a request id', async () => {
    const response = await request(createApp()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('echoes an incoming x-request-id', async () => {
    const response = await request(createApp()).get('/health/live').set('x-request-id', 'trace-abc');

    expect(response.headers['x-request-id']).toBe('trace-abc');
  });

  it('reports ready when the database responds', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await request(createApp()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
  });

  it('reports not ready when the database is unreachable', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('connection refused'));

    const response = await request(createApp()).get('/health/ready');

    expect(response.status).toBe(500);
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const response = await request(createApp()).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('sets security headers and hides x-powered-by', async () => {
    const response = await request(createApp()).get('/health/live');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
