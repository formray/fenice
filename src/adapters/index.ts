import type { EmailAdapter } from './email/types.js';
import type { StorageAdapter } from './storage/types.js';
import type { MessagingAdapter } from './messaging/types.js';
import { ConsoleEmailAdapter } from './email/console.adapter.js';
import { LocalStorageAdapter } from './storage/local.adapter.js';
import { ConsoleMessagingAdapter } from './messaging/console.adapter.js';

export interface Adapters {
  email: EmailAdapter;
  storage: StorageAdapter;
  messaging: MessagingAdapter;
}

export function createAdapters(): Adapters {
  // In production, swap these for real adapters based on env vars
  return {
    email: new ConsoleEmailAdapter(),
    storage: new LocalStorageAdapter(),
    messaging: new ConsoleMessagingAdapter(),
  };
}

// Re-export types
export type { EmailAdapter } from './email/types.js';
export type { StorageAdapter } from './storage/types.js';
export type { MessagingAdapter } from './messaging/types.js';
