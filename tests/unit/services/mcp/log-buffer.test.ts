import { describe, it, expect } from 'vitest';
import { LogRingBuffer } from '../../../../src/services/mcp/log-buffer.js';

describe('LogRingBuffer', () => {
  it('rejects non-positive capacity', () => {
    expect(() => new LogRingBuffer(0)).toThrow();
    expect(() => new LogRingBuffer(-1)).toThrow();
  });

  it('stores up to capacity then evicts oldest', () => {
    const buf = new LogRingBuffer(3);
    for (let i = 0; i < 5; i++) {
      buf.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `msg ${i}`,
        fields: { i },
      });
    }
    expect(buf.size()).toBe(3);
    const all = buf.query({ limit: 100 });
    expect(all.map((r) => r.message)).toEqual(['msg 2', 'msg 3', 'msg 4']);
  });

  it('filters by level', () => {
    const buf = new LogRingBuffer(10);
    buf.push({ timestamp: 't1', level: 'info', message: 'a', fields: {} });
    buf.push({ timestamp: 't2', level: 'error', message: 'b', fields: {} });
    buf.push({ timestamp: 't3', level: 'info', message: 'c', fields: {} });

    expect(buf.query({ level: 'error' })).toHaveLength(1);
    expect(buf.query({ level: 'error' })[0]?.message).toBe('b');
    expect(buf.query({ level: 'info' })).toHaveLength(2);
  });

  it('filters by case-insensitive pattern across message and fields', () => {
    const buf = new LogRingBuffer(10);
    buf.push({
      timestamp: 't1',
      level: 'info',
      message: 'login successful',
      fields: { userId: 'u1' },
    });
    buf.push({
      timestamp: 't2',
      level: 'info',
      message: 'request completed',
      fields: { method: 'GET', path: '/api/v1/health' },
    });

    expect(buf.query({ pattern: 'LOGIN' })).toHaveLength(1);
    expect(buf.query({ pattern: '/health' })).toHaveLength(1);
    expect(buf.query({ pattern: 'nope' })).toHaveLength(0);
  });

  it('respects limit and returns most recent records', () => {
    const buf = new LogRingBuffer(10);
    for (let i = 0; i < 8; i++) {
      buf.push({ timestamp: `t${i}`, level: 'info', message: `m${i}`, fields: {} });
    }
    const recent = buf.query({ limit: 3 });
    expect(recent.map((r) => r.message)).toEqual(['m5', 'm6', 'm7']);
  });

  it('clear() empties the buffer', () => {
    const buf = new LogRingBuffer(5);
    buf.push({ timestamp: 't', level: 'info', message: 'x', fields: {} });
    buf.clear();
    expect(buf.size()).toBe(0);
  });
});
