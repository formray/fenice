import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GcsStorageAdapter } from '../../../src/adapters/storage/gcs.adapter.js';

// Mock functions
const mockUpload = vi.fn().mockResolvedValue(undefined);
const mockDownload = vi.fn().mockResolvedValue([Buffer.from('test-data')]);
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockGetSignedUrl = vi.fn().mockResolvedValue(['https://storage.googleapis.com/signed-url']);
const mockFile = vi.fn().mockReturnValue({
  save: mockUpload,
  download: mockDownload,
  delete: mockDelete,
  getSignedUrl: mockGetSignedUrl,
});

vi.mock('@google-cloud/storage', () => ({
  Storage: class {
    bucket() {
      return { file: mockFile };
    }
  },
}));

describe('GcsStorageAdapter', () => {
  let adapter: GcsStorageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GcsStorageAdapter('test-bucket', 'test-project');
  });

  it('should upload a file and return the GCS URI', async () => {
    const result = await adapter.upload('path/to/file.png', Buffer.from('data'), 'image/png');

    expect(mockFile).toHaveBeenCalledWith('path/to/file.png');
    expect(mockUpload).toHaveBeenCalledWith(Buffer.from('data'), {
      contentType: 'image/png',
      resumable: false,
    });
    expect(result).toBe('gs://test-bucket/path/to/file.png');
  });

  it('should download a file and return the buffer', async () => {
    const result = await adapter.download('path/to/file.png');

    expect(mockFile).toHaveBeenCalledWith('path/to/file.png');
    expect(mockDownload).toHaveBeenCalled();
    expect(result).toEqual(Buffer.from('test-data'));
  });

  it('should delete a file', async () => {
    await adapter.delete('path/to/file.png');

    expect(mockFile).toHaveBeenCalledWith('path/to/file.png');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should get a signed URL with default expiration', async () => {
    const result = await adapter.getSignedUrl('path/to/file.png');

    expect(mockFile).toHaveBeenCalledWith('path/to/file.png');
    expect(mockGetSignedUrl).toHaveBeenCalledWith({
      action: 'read',
      expires: expect.any(Number) as number,
    });
    expect(result).toBe('https://storage.googleapis.com/signed-url');
  });

  it('should get a signed URL with custom expiration', async () => {
    const result = await adapter.getSignedUrl('path/to/file.png', 7200);

    expect(mockGetSignedUrl).toHaveBeenCalledWith({
      action: 'read',
      expires: expect.any(Number) as number,
    });
    expect(result).toBe('https://storage.googleapis.com/signed-url');
  });

  it('should propagate errors from GCS', async () => {
    mockUpload.mockRejectedValueOnce(new Error('GCS upload failed'));

    await expect(adapter.upload('file.png', Buffer.from('data'), 'image/png')).rejects.toThrow(
      'GCS upload failed'
    );
  });
});
