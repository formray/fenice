import { z } from 'zod';

const MAX_FILE_SIZE = 104_857_600; // 100MB
const CHUNK_SIZE = 5_242_880; // 5MB

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

export const InitUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  totalSize: z.number().int().positive().max(MAX_FILE_SIZE),
});

export const InitUploadResponseSchema = z.object({
  uploadId: z.string(),
  chunkSize: z.number(),
  totalChunks: z.number(),
  expiresAt: z.iso.datetime(),
});

export const ChunkParamsSchema = z.object({
  uploadId: z.string().min(1),
  index: z.coerce.number().int().min(0),
});

export const ChunkResponseSchema = z.object({
  uploaded: z.number(),
  totalChunks: z.number(),
  progress: z.string(),
});

export const CompleteUploadSchema = z.object({
  uploadId: z.string().min(1),
});

export const CompleteUploadResponseSchema = z.object({
  fileId: z.string(),
  fileUrl: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  createdAt: z.iso.datetime(),
});

export type InitUpload = z.infer<typeof InitUploadSchema>;
export type ChunkParams = z.infer<typeof ChunkParamsSchema>;
export type CompleteUpload = z.infer<typeof CompleteUploadSchema>;

export { MAX_FILE_SIZE, CHUNK_SIZE, ALLOWED_MIME_TYPES };
