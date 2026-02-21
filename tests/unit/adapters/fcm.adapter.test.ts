import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FcmMessagingAdapter } from '../../../src/adapters/messaging/fcm.adapter.js';

const { mockSend, mockMessaging, mockInitializeApp } = vi.hoisted(() => {
  const mockSend = vi.fn().mockResolvedValue('message-id-123');
  const mockMessaging = vi.fn().mockReturnValue({ send: mockSend });
  const mockInitializeApp = vi.fn();
  return { mockSend, mockMessaging, mockInitializeApp };
});

vi.mock('firebase-admin', () => ({
  default: {
    initializeApp: mockInitializeApp,
    messaging: mockMessaging,
    credential: {
      cert: vi.fn().mockReturnValue('mock-credential'),
    },
  },
}));

describe('FcmMessagingAdapter', () => {
  let adapter: FcmMessagingAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new FcmMessagingAdapter('/path/to/service-account.json');
  });

  it('should initialize firebase app with service account credential', () => {
    expect(mockInitializeApp).toHaveBeenCalled();
  });

  it('should send notification with correct payload', async () => {
    await adapter.send({
      to: 'device-token-123',
      title: 'Test Title',
      body: 'Test Body',
    });

    expect(mockMessaging).toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledWith({
      token: 'device-token-123',
      notification: {
        title: 'Test Title',
        body: 'Test Body',
      },
    });
  });

  it('should include data payload when provided', async () => {
    await adapter.send({
      to: 'device-token-123',
      title: 'Test Title',
      body: 'Test Body',
      data: { key: 'value', action: 'open' },
    });

    expect(mockSend).toHaveBeenCalledWith({
      token: 'device-token-123',
      notification: {
        title: 'Test Title',
        body: 'Test Body',
      },
      data: { key: 'value', action: 'open' },
    });
  });

  it('should propagate errors from Firebase', async () => {
    mockSend.mockRejectedValueOnce(new Error('FCM send failed'));

    await expect(
      adapter.send({
        to: 'device-token-123',
        title: 'Test',
        body: 'Test',
      })
    ).rejects.toThrow('FCM send failed');
  });
});
