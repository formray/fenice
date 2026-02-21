import { randomUUID } from 'node:crypto';
import type { StorageAdapter } from '../adapters/storage/types.js';
import { UploadError, NotFoundError } from '../utils/errors.js';

export interface UploadConfig {
  maxSizeBytes: number;
  chunkSizeBytes: number;
  sessionTimeoutMs: number;
  maxConcurrent: number;
}

interface UploadMetadata {
  filename: string;
  contentType: string;
  totalSize: number;
}

interface UploadSession {
  uploadId: string;
  userId: string;
  filename: string;
  contentType: string;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: Set<number>;
  createdAt: Date;
  expiresAt: Date;
}

interface InitUploadResult {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  expiresAt: Date;
}

interface ChunkProgress {
  uploaded: number;
  totalChunks: number;
  progress: string;
}

interface FileMetadata {
  fileId: string;
  fileUrl: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: Date;
}

export class UploadService {
  private readonly sessions = new Map<string, UploadSession>();

  constructor(
    private readonly storage: StorageAdapter,
    private readonly config: UploadConfig
  ) {}

  initUpload(userId: string, metadata: UploadMetadata): InitUploadResult {
    if (metadata.totalSize > this.config.maxSizeBytes) {
      throw new UploadError(
        `File size ${metadata.totalSize} exceeds maximum ${this.config.maxSizeBytes}`
      );
    }

    const uploadId = randomUUID();
    const chunkSize = this.config.chunkSizeBytes;
    const totalChunks = Math.ceil(metadata.totalSize / chunkSize);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionTimeoutMs);

    const session: UploadSession = {
      uploadId,
      userId,
      filename: metadata.filename,
      contentType: metadata.contentType,
      totalSize: metadata.totalSize,
      chunkSize,
      totalChunks,
      uploadedChunks: new Set<number>(),
      createdAt: now,
      expiresAt,
    };

    this.sessions.set(uploadId, session);

    return { uploadId, chunkSize, totalChunks, expiresAt };
  }

  async uploadChunk(uploadId: string, index: number, data: Buffer): Promise<ChunkProgress> {
    const session = this.getSession(uploadId);

    if (index < 0 || index >= session.totalChunks) {
      throw new UploadError(`Invalid chunk index ${index}. Expected 0-${session.totalChunks - 1}`);
    }

    const chunkKey = `uploads/${uploadId}/chunk-${index}`;
    await this.storage.upload(chunkKey, data, session.contentType);
    session.uploadedChunks.add(index);

    const uploaded = session.uploadedChunks.size;
    const progress = `${Math.round((uploaded / session.totalChunks) * 100)}%`;

    return { uploaded, totalChunks: session.totalChunks, progress };
  }

  async completeUpload(uploadId: string): Promise<FileMetadata> {
    const session = this.getSession(uploadId);

    if (session.uploadedChunks.size !== session.totalChunks) {
      throw new UploadError(
        `Not all chunks uploaded: ${session.uploadedChunks.size}/${session.totalChunks}`
      );
    }

    // Download all chunks in order and concatenate
    const chunkBuffers: Buffer[] = [];
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkKey = `uploads/${uploadId}/chunk-${i}`;
      const chunkData = await this.storage.download(chunkKey);
      chunkBuffers.push(chunkData);
    }

    const assembled = Buffer.concat(chunkBuffers);

    // Upload the assembled file
    const fileKey = `uploads/${session.userId}/${session.filename}`;
    const fileUrl = await this.storage.upload(fileKey, assembled, session.contentType);

    // Clean up chunk keys
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkKey = `uploads/${uploadId}/chunk-${i}`;
      await this.storage.delete(chunkKey);
    }

    const fileId = randomUUID();
    const createdAt = new Date();

    // Remove session
    this.sessions.delete(uploadId);

    return {
      fileId,
      fileUrl,
      filename: session.filename,
      contentType: session.contentType,
      size: session.totalSize,
      createdAt,
    };
  }

  async cancelUpload(uploadId: string): Promise<void> {
    const session = this.getSession(uploadId);

    // Delete all uploaded chunks
    for (const index of session.uploadedChunks) {
      const chunkKey = `uploads/${uploadId}/chunk-${index}`;
      await this.storage.delete(chunkKey);
    }

    this.sessions.delete(uploadId);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [uploadId, session] of this.sessions) {
      if (session.expiresAt.getTime() <= now) {
        this.sessions.delete(uploadId);
      }
    }
  }

  private getSession(uploadId: string): UploadSession {
    const session = this.sessions.get(uploadId);
    if (!session) {
      throw new NotFoundError(`Upload session '${uploadId}' not found`);
    }
    return session;
  }
}
