import type { MessagingAdapter } from './types.js';

export class ConsoleMessagingAdapter implements MessagingAdapter {
  send(options: {
    to: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    console.warn(`[PUSH] To: ${options.to} | Title: ${options.title}`);
    console.warn(`[PUSH] Body: ${options.body}`);
    if (options.data) {
      console.warn(`[PUSH] Data: ${JSON.stringify(options.data)}`);
    }
    return Promise.resolve();
  }
}
