import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('GET /api/health Endpoint', () => {
  it('should return 200 OK with valid health structure and mandatory headers', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-legal-disclaimer']).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();

    expect(res.body.success).toBe(true);
    expect(res.body.disclaimer).toContain('does not provide legal advice');
    expect(res.body.request_id).toBeDefined();

    const data = res.body.data;
    expect(data.architecture).toBe('v2');
    expect(data.database).toBeDefined();
    expect(data.cache).toBeDefined();
    expect(data.queue).toBeDefined();
    expect(data.ai_engine).toBeDefined();
    expect(data.ai_engine.model_reasoning).toBe('gemini-3.8-flash');
  });

  it('should return 404 with standard error envelope on invalid routes', async () => {
    const res = await request(app).get('/api/non-existent-route');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    expect(res.body.disclaimer).toBeDefined();
    expect(res.body.request_id).toBeDefined();
  });
});
