import { Storage } from '@google-cloud/storage';
import type { StorageAdapter } from './types.js';

const DEFAULT_SIGNED_URL_EXPIRY = 3600; // 1 hour

export class GcsStorageAdapter implements StorageAdapter {
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(bucketName: string, projectId: string) {
    this.bucketName = bucketName;
    this.storage = new Storage({ projectId });
  }

  async upload(key: string, data: Buffer, contentType: string): Promise<string> {
    const file = this.storage.bucket(this.bucketName).file(key);
    await file.save(data, { contentType, resumable: false });
    return `gs://${this.bucketName}/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const file = this.storage.bucket(this.bucketName).file(key);
    const [contents] = await file.download();
    return contents;
  }

  async delete(key: string): Promise<void> {
    const file = this.storage.bucket(this.bucketName).file(key);
    await file.delete();
  }

  async getSignedUrl(key: string, expiresInSeconds?: number): Promise<string> {
    const file = this.storage.bucket(this.bucketName).file(key);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + (expiresInSeconds ?? DEFAULT_SIGNED_URL_EXPIRY) * 1000,
    });
    return url;
  }
}
