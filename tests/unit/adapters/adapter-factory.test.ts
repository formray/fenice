import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('firebase-admin', () => ({
  default: {
    initializeApp: vi.fn(),
    messaging: vi.fn().mockReturnValue({ send: vi.fn() }),
    credential: {
      cert: vi.fn().mockReturnValue('mock-credential'),
    },
  },
}));

describe('Adapter Factory', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return console/local adapters when no env vars set', async () => {
    const { createAdapters } = await import('../../../src/adapters/index.js');
    const { ConsoleEmailAdapter } = await import('../../../src/adapters/email/console.adapter.js');
    const { LocalStorageAdapter } = await import('../../../src/adapters/storage/local.adapter.js');
    const { ConsoleMessagingAdapter } =
      await import('../../../src/adapters/messaging/console.adapter.js');

    const adapters = createAdapters();
    expect(adapters.email).toBeInstanceOf(ConsoleEmailAdapter);
    expect(adapters.storage).toBeInstanceOf(LocalStorageAdapter);
    expect(adapters.messaging).toBeInstanceOf(ConsoleMessagingAdapter);
  });

  it('should return ResendEmailAdapter when RESEND_API_KEY is set', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    const { createAdapters } = await import('../../../src/adapters/index.js');
    const { ResendEmailAdapter } = await import('../../../src/adapters/email/resend.adapter.js');

    const adapters = createAdapters();
    expect(adapters.email).toBeInstanceOf(ResendEmailAdapter);
  });

  it('should return GcsStorageAdapter when GCS env vars are set', async () => {
    vi.stubEnv('GCS_BUCKET_NAME', 'test-bucket');
    vi.stubEnv('GCS_PROJECT_ID', 'test-project');
    const { createAdapters } = await import('../../../src/adapters/index.js');
    const { GcsStorageAdapter } = await import('../../../src/adapters/storage/gcs.adapter.js');

    const adapters = createAdapters();
    expect(adapters.storage).toBeInstanceOf(GcsStorageAdapter);
  });

  it('should return FcmMessagingAdapter when FCM env vars are set', async () => {
    vi.stubEnv('FCM_PROJECT_ID', 'test-project');
    vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '/path/to/creds.json');
    const { createAdapters } = await import('../../../src/adapters/index.js');
    const { FcmMessagingAdapter } = await import('../../../src/adapters/messaging/fcm.adapter.js');

    const adapters = createAdapters();
    expect(adapters.messaging).toBeInstanceOf(FcmMessagingAdapter);
  });
});
