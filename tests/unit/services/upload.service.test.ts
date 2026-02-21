import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadService } from '../../../src/services/upload.service.js';
import type { StorageAdapter } from '../../../src/adapters/storage/types.js';
import { UploadError, NotFoundError } from '../../../src/utils/errors.js';

interface MockStorage extends StorageAdapter {
  upload: ReturnType<typeof vi.fn>;
  download: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  getSignedUrl: ReturnType<typeof vi.fn>;
}

function createMockStorage(): MockStorage {
  return {
    upload: vi.fn().mockResolvedValue('https://storage.test/file'),
    download: vi.fn().mockResolvedValue(Buffer.from('chunk-data')),
    delete: vi.fn().mockResolvedValue(undefined),
    getSignedUrl: vi.fn().mockResolvedValue('https://storage.test/signed'),
  };
}

describe('UploadService', () => {
  let service: UploadService;
  let storage: MockStorage;

  const defaultConfig = {
    maxSizeBytes: 104_857_600, // 100MB
    chunkSizeBytes: 5_242_880, // 5MB
    sessionTimeoutMs: 3_600_000, // 1h
    maxConcurrent: 3,
  };

  beforeEach(() => {
    storage = createMockStorage();
    service = new UploadService(storage, defaultConfig);
  });

  describe('initUpload', () => {
    it('should create a session and return uploadId, chunkSize, totalChunks, expiresAt', () => {
      const result = service.initUpload('user-1', {
        filename: 'photo.png',
        contentType: 'image/png',
        totalSize: 10_485_760, // 10MB
      });

      expect(result.uploadId).toBeDefined();
      expect(typeof result.uploadId).toBe('string');
      expect(result.chunkSize).toBe(defaultConfig.chunkSizeBytes);
      expect(result.totalChunks).toBe(2); // ceil(10MB / 5MB)
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reject files over max size', () => {
      expect(() =>
        service.initUpload('user-1', {
          filename: 'huge.bin',
          contentType: 'application/octet-stream',
          totalSize: 200_000_000, // 200MB > 100MB
        })
      ).toThrow(UploadError);
    });
  });

  describe('uploadChunk', () => {
    it('should store chunk via adapter and return progress', async () => {
      const { uploadId, totalChunks } = service.initUpload('user-1', {
        filename: 'file.bin',
        contentType: 'application/octet-stream',
        totalSize: 10_485_760,
      });

      const data = Buffer.from('chunk-content');
      const result = await service.uploadChunk(uploadId, 0, data);

      expect(storage.upload).toHaveBeenCalledWith(
        `uploads/${uploadId}/chunk-0`,
        data,
        'application/octet-stream'
      );
      expect(result.uploaded).toBe(1);
      expect(result.totalChunks).toBe(totalChunks);
      expect(result.progress).toBeDefined();
    });

    it('should reject invalid chunk index', async () => {
      const { uploadId, totalChunks } = service.initUpload('user-1', {
        filename: 'file.bin',
        contentType: 'application/octet-stream',
        totalSize: 10_485_760,
      });

      const data = Buffer.from('chunk-content');
      await expect(service.uploadChunk(uploadId, totalChunks, data)).rejects.toThrow(UploadError);
      await expect(service.uploadChunk(uploadId, -1, data)).rejects.toThrow(UploadError);
    });

    it('should reject chunk for unknown session', async () => {
      const data = Buffer.from('chunk-content');
      await expect(service.uploadChunk('nonexistent-id', 0, data)).rejects.toThrow(NotFoundError);
    });
  });

  describe('completeUpload', () => {
    it('should assemble chunks and return file metadata', async () => {
      const chunkSize = 10;
      const svc = new UploadService(storage, { ...defaultConfig, chunkSizeBytes: chunkSize });

      const { uploadId } = svc.initUpload('user-1', {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
        totalSize: 25, // 3 chunks: 10 + 10 + 5
      });

      const chunk0 = Buffer.alloc(chunkSize, 'a');
      const chunk1 = Buffer.alloc(chunkSize, 'b');
      const chunk2 = Buffer.alloc(5, 'c');

      // Mock download to return the specific chunk data
      storage.download
        .mockResolvedValueOnce(chunk0)
        .mockResolvedValueOnce(chunk1)
        .mockResolvedValueOnce(chunk2);

      await svc.uploadChunk(uploadId, 0, chunk0);
      await svc.uploadChunk(uploadId, 1, chunk1);
      await svc.uploadChunk(uploadId, 2, chunk2);

      const result = await svc.completeUpload(uploadId);

      expect(result.filename).toBe('doc.pdf');
      expect(result.contentType).toBe('application/pdf');
      expect(result.size).toBe(25);
      expect(result.fileUrl).toBeDefined();
      expect(result.fileId).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);

      // Should have uploaded the assembled file
      expect(storage.upload).toHaveBeenCalledWith(
        expect.stringContaining('uploads/user-1/doc.pdf'),
        expect.any(Buffer),
        'application/pdf'
      );

      // Should have cleaned up chunk keys
      expect(storage.delete).toHaveBeenCalledWith(`uploads/${uploadId}/chunk-0`);
      expect(storage.delete).toHaveBeenCalledWith(`uploads/${uploadId}/chunk-1`);
      expect(storage.delete).toHaveBeenCalledWith(`uploads/${uploadId}/chunk-2`);
    });

    it('should reject if not all chunks uploaded', async () => {
      const chunkSize = 10;
      const svc = new UploadService(storage, { ...defaultConfig, chunkSizeBytes: chunkSize });

      const { uploadId } = svc.initUpload('user-1', {
        filename: 'file.bin',
        contentType: 'application/octet-stream',
        totalSize: 25, // needs 3 chunks
      });

      await svc.uploadChunk(uploadId, 0, Buffer.alloc(chunkSize));
      // Only uploaded 1 of 3 chunks

      await expect(svc.completeUpload(uploadId)).rejects.toThrow(UploadError);
    });

    it('should reject for unknown session', async () => {
      await expect(service.completeUpload('nonexistent-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('cancelUpload', () => {
    it('should clean up chunks and remove session', async () => {
      const chunkSize = 10;
      const svc = new UploadService(storage, { ...defaultConfig, chunkSizeBytes: chunkSize });

      const { uploadId } = svc.initUpload('user-1', {
        filename: 'file.bin',
        contentType: 'application/octet-stream',
        totalSize: 25,
      });

      await svc.uploadChunk(uploadId, 0, Buffer.alloc(chunkSize));
      await svc.uploadChunk(uploadId, 1, Buffer.alloc(chunkSize));

      await svc.cancelUpload(uploadId);

      // Should have deleted the uploaded chunks
      expect(storage.delete).toHaveBeenCalledWith(`uploads/${uploadId}/chunk-0`);
      expect(storage.delete).toHaveBeenCalledWith(`uploads/${uploadId}/chunk-1`);

      // Session should be gone — further operations should fail
      await expect(svc.uploadChunk(uploadId, 2, Buffer.alloc(5))).rejects.toThrow(NotFoundError);
    });

    it('should reject for unknown session', async () => {
      await expect(service.cancelUpload('nonexistent-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('cleanup', () => {
    it('should remove expired sessions', async () => {
      const svc = new UploadService(storage, { ...defaultConfig, sessionTimeoutMs: 0 });

      const { uploadId } = svc.initUpload('user-1', {
        filename: 'file.bin',
        contentType: 'application/octet-stream',
        totalSize: 100,
      });

      // Session should already be expired (timeout = 0ms)
      svc.cleanup();

      // Session should be removed — uploadChunk should throw NotFoundError
      await expect(svc.uploadChunk(uploadId, 0, Buffer.alloc(10))).rejects.toThrow(NotFoundError);
    });

    it('should not remove active sessions', () => {
      const { uploadId } = service.initUpload('user-1', {
        filename: 'file.bin',
        contentType: 'application/octet-stream',
        totalSize: 5_242_880,
      });

      service.cleanup();

      // Session should still be active — uploadChunk should work
      return expect(service.uploadChunk(uploadId, 0, Buffer.alloc(100))).resolves.toBeDefined();
    });
  });
});
