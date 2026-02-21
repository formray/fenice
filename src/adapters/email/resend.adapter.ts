import { Resend } from 'resend';
import type { EmailAdapter } from './types.js';

const DEFAULT_FROM = 'FENICE <noreply@fenice.app>';

export class ResendEmailAdapter implements EmailAdapter {
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(options: { to: string; subject: string; html: string; from?: string }): Promise<void> {
    await this.client.emails.send({
      from: options.from ?? DEFAULT_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }
}
