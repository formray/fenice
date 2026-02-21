import type { EmailAdapter } from './types.js';

export class ResendEmailAdapter implements EmailAdapter {
  constructor(private readonly _apiKey: string) {}

  send(options: { to: string; subject: string; html: string; from?: string }): Promise<void> {
    // Resend API integration placeholder
    // npm install resend when ready for production
    return Promise.reject(
      new Error(`Resend adapter not yet implemented. Would send to: ${options.to}`)
    );
  }
}
