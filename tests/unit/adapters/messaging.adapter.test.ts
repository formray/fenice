import { describe, it, expect, vi } from 'vitest';
import { ConsoleMessagingAdapter } from '../../../src/adapters/messaging/console.adapter.js';

describe('ConsoleMessagingAdapter', () => {
  it('should log push notification details to console', async () => {
    const adapter = new ConsoleMessagingAdapter();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await adapter.send({
      to: 'device-token-123',
      title: 'Test Notification',
      body: 'This is a test push notification',
    });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('device-token-123')
    );
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Test Notification')
    );
    spy.mockRestore();
  });

  it('should log data payload when provided', async () => {
    const adapter = new ConsoleMessagingAdapter();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await adapter.send({
      to: 'device-token-456',
      title: 'Data Notification',
      body: 'Notification with data',
      data: { action: 'open_screen', screenId: 'profile' },
    });

    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('"action":"open_screen"')
    );
    spy.mockRestore();
  });

  it('should not log data line when data is omitted', async () => {
    const adapter = new ConsoleMessagingAdapter();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await adapter.send({
      to: 'device-token-789',
      title: 'Simple',
      body: 'No data',
    });

    // Only 2 calls: To/Title line and Body line (no Data line)
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
