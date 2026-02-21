import { describe, it, expect } from 'vitest';
import { app } from '../../src/index.js';

describe('MCP Discovery Endpoint', () => {
  it('GET /api/v1/mcp should return MCP manifest', async () => {
    const res = await app.request('/api/v1/mcp');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('name', 'fenice');
    expect(body).toHaveProperty('tools');
    expect(body).toHaveProperty('resources');
    expect(body.tools.length).toBeGreaterThan(0);
  });

  it('should include auth tools', async () => {
    const res = await app.request('/api/v1/mcp');
    const body = await res.json();
    const toolNames = body.tools.map((t: any) => t.name);
    expect(toolNames).toContain('auth_signup');
    expect(toolNames).toContain('auth_login');
  });
});
