import type { StorageAdapter } from './types.js';

export class GcsStorageAdapter implements StorageAdapter {
  constructor(
    private readonly bucketName: string,
    private readonly projectId: string
  ) {}

  upload(_key: string, _data: Buffer, _contentType: string): Promise<string> {
    // Google Cloud Storage integration placeholder
    // npm install @google-cloud/storage when ready for production
    return Promise.reject(
      new Error(
        `GCS adapter not yet implemented. Bucket: ${this.bucketName}, Project: ${this.projectId}`
      )
    );
  }

  download(_key: string): Promise<Buffer> {
    return Promise.reject(new Error('GCS adapter not yet implemented'));
  }

  delete(_key: string): Promise<void> {
    return Promise.reject(new Error('GCS adapter not yet implemented'));
  }

  getSignedUrl(_key: string, _expiresInSeconds?: number): Promise<string> {
    return Promise.reject(new Error('GCS adapter not yet implemented'));
  }
}
