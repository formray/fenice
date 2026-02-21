import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResendEmailAdapter } from '../../../src/adapters/email/resend.adapter.js';

const mockSend = vi.fn().mockResolvedValue({ id: 'test-id' });

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

describe('ResendEmailAdapter', () => {
  let adapter: ResendEmailAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ResendEmailAdapter('test-api-key');
  });

  it('should call Resend emails.send with correct params', async () => {
    await adapter.send({
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: 'FENICE <noreply@fenice.app>',
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
    });
  });

  it('should use custom from address when provided', async () => {
    await adapter.send({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
      from: 'custom@example.com',
    });

    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ from: 'custom@example.com' }));
  });

  it('should propagate errors from the Resend API', async () => {
    mockSend.mockRejectedValueOnce(new Error('API error'));

    await expect(
      adapter.send({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      })
    ).rejects.toThrow('API error');
  });
});
