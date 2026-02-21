export interface MessagingAdapter {
  send(options: {
    to: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void>;
}
