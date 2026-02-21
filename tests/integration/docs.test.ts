import { describe, it, expect } from 'vitest';
import { app } from '../../src/index.js';

describe('Documentation Endpoints', () => {
  it('GET /openapi should return OpenAPI spec', async () => {
    const res = await app.request('/openapi');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('openapi', '3.1.0');
    expect(body).toHaveProperty('info');
    expect(body.info).toHaveProperty('title', 'FENICE API');
    expect(body).toHaveProperty('paths');
  });

  it('GET /docs/llm should return markdown', async () => {
    const res = await app.request('/docs/llm');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('FENICE API');
    expect(text).toContain('## Endpoints');
  });

  it('GET /docs should return Scalar HTML', async () => {
    const res = await app.request('/docs');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('html');
  });
});
