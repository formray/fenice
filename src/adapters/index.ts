import type { EmailAdapter } from './email/types.js';
import type { MessagingAdapter } from './messaging/types.js';
import type { StorageAdapter } from './storage/types.js';
import { ConsoleEmailAdapter } from './email/console.adapter.js';
import { ResendEmailAdapter } from './email/resend.adapter.js';
import { ConsoleMessagingAdapter } from './messaging/console.adapter.js';
import { FcmMessagingAdapter } from './messaging/fcm.adapter.js';
import { LocalStorageAdapter } from './storage/local.adapter.js';
import { GcsStorageAdapter } from './storage/gcs.adapter.js';

export interface Adapters {
  email: EmailAdapter;
  storage: StorageAdapter;
  messaging: MessagingAdapter;
}

export function createAdapters(): Adapters {
  const resendApiKey = process.env['RESEND_API_KEY'];
  const gcsBucketName = process.env['GCS_BUCKET_NAME'];
  const gcsProjectId = process.env['GCS_PROJECT_ID'];
  const fcmProjectId = process.env['FCM_PROJECT_ID'];
  const googleCredentials = process.env['GOOGLE_APPLICATION_CREDENTIALS'];

  return {
    email: resendApiKey ? new ResendEmailAdapter(resendApiKey) : new ConsoleEmailAdapter(),

    storage:
      gcsBucketName && gcsProjectId
        ? new GcsStorageAdapter(gcsBucketName, gcsProjectId)
        : new LocalStorageAdapter(),

    messaging:
      fcmProjectId && googleCredentials
        ? new FcmMessagingAdapter(googleCredentials)
        : new ConsoleMessagingAdapter(),
  };
}

// Re-export types
export type { EmailAdapter } from './email/types.js';
export type { StorageAdapter } from './storage/types.js';
export type { MessagingAdapter } from './messaging/types.js';
