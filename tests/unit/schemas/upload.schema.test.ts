import { describe, it, expect } from 'vitest';
import { InitUploadSchema, CompleteUploadSchema } from '../../../src/schemas/upload.schema.js';

describe('upload schemas', () => {
  describe('InitUploadSchema', () => {
    it('should accept valid upload init', () => {
      const result = InitUploadSchema.safeParse({
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        totalSize: 5_000_000,
      });
      expect(result.success).toBe(true);
    });

    it('should reject file over 100MB', () => {
      const result = InitUploadSchema.safeParse({
        filename: 'huge.mp4',
        contentType: 'video/mp4',
        totalSize: 200_000_000,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing filename', () => {
      const result = InitUploadSchema.safeParse({
        contentType: 'image/jpeg',
        totalSize: 1000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CompleteUploadSchema', () => {
    it('should accept valid complete upload', () => {
      const result = CompleteUploadSchema.safeParse({
        uploadId: 'abc-123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty uploadId', () => {
      const result = CompleteUploadSchema.safeParse({
        uploadId: '',
      });
      expect(result.success).toBe(false);
    });
  });
});
