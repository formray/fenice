export interface EmailAdapter {
  send(options: {
    to: string;
    subject: string;
    html: string;
    from?: string;
  }): Promise<void>;
}
