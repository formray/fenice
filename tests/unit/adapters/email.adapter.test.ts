import { describe, it, expect, vi } from 'vitest';
import { ConsoleEmailAdapter } from '../../../src/adapters/email/console.adapter.js';

describe('ConsoleEmailAdapter', () => {
  it('should log email details to console', async () => {
    const adapter = new ConsoleEmailAdapter();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await adapter.send({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
