import admin from 'firebase-admin';
import type { MessagingAdapter } from './types.js';

export class FcmMessagingAdapter implements MessagingAdapter {
  constructor(serviceAccountPath: string) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
    });
  }

  async send(options: {
    to: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    const message: admin.messaging.Message = {
      token: options.to,
      notification: {
        title: options.title,
        body: options.body,
      },
    };

    if (options.data) {
      message.data = options.data;
    }

    await admin.messaging().send(message);
  }
}
