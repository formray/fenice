import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCheckoutLocalBranch = vi.fn();
const mockAdd = vi.fn();
const mockCommit = vi.fn().mockResolvedValue({ commit: 'abc123' });
const mockPush = vi.fn();
const mockCheckout = vi.fn();
const mockDeleteLocalBranch = vi.fn();
const mockBranch = vi.fn().mockResolvedValue({ current: 'builder/test-branch' });

function createMockGit() {
  return {
    checkoutLocalBranch: (...args: unknown[]) => mockCheckoutLocalBranch(...args),
    add: (...args: unknown[]) => mockAdd(...args),
    commit: (...args: unknown[]) => mockCommit(...args),
    push: (...args: unknown[]) => mockPush(...args),
    checkout: (...args: unknown[]) => mockCheckout(...args),
    deleteLocalBranch: (...args: unknown[]) => mockDeleteLocalBranch(...args),
    branch: (...args: unknown[]) => mockBranch(...args),
  };
}

vi.mock('simple-git', () => ({
  simpleGit: () => createMockGit(),
}));

const { createBranchAndCommit, createDraftBranchAndCommit, pushBranch, cleanupBranch } =
  await import('../../../../src/services/builder/git-ops.js');

describe('git-ops', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommit.mockResolvedValue({ commit: 'abc123' });
    mockBranch.mockResolvedValue({ current: 'builder/test-branch' });
  });

  describe('createBranchAndCommit', () => {
    it('should create a branch with jobId and slug', async () => {
      const result = await createBranchAndCommit('/project', 'job-123', 'Add a products endpoint', [
        'src/schemas/product.schema.ts',
      ]);

      expect(result.branch).toMatch(/^builder\/job-123-add-a-products-endpoint$/);
      expect(result.commitHash).toBe('abc123');
      expect(mockCheckoutLocalBranch).toHaveBeenCalledWith(result.branch);
    });

    it('should stage all provided files', async () => {
      const files = ['src/schemas/product.schema.ts', 'src/models/product.model.ts'];
      await createBranchAndCommit('/project', 'job-123', 'Add products', files);

      expect(mockAdd).toHaveBeenCalledWith(files);
    });

    it('should commit with conventional commit message', async () => {
      await createBranchAndCommit('/project', 'job-123', 'Add a products endpoint', [
        'src/schemas/product.schema.ts',
      ]);

      const commitMsg = mockCommit.mock.calls[0]?.[0] as string;
      expect(commitMsg).toContain('feat(builder):');
      expect(commitMsg).toContain('Add a products endpoint');
      expect(commitMsg).toContain('Co-Authored-By: Claude Opus 4.6');
      expect(commitMsg).toContain('job-123');
    });

    it('should truncate long prompts in commit message', async () => {
      const longPrompt = 'A'.repeat(100);
      await createBranchAndCommit('/project', 'job-123', longPrompt, ['file.ts']);

      const commitMsg = mockCommit.mock.calls[0]?.[0] as string;
      expect(commitMsg).toContain('...');
    });

    it('should truncate long slugs in branch name', async () => {
      const longPrompt = 'This is a very long prompt that should be truncated for the branch name';
      const result = await createBranchAndCommit('/project', 'job-123', longPrompt, ['file.ts']);

      // Branch slug should be max 40 chars
      const slug = result.branch.replace('builder/job-123-', '');
      expect(slug.length).toBeLessThanOrEqual(40);
    });
  });

  describe('createDraftBranchAndCommit', () => {
    it('should create a branch with draft/ prefix', async () => {
      const result = await createDraftBranchAndCommit('/project', 'job-456', 'Fix auth bug', [
        'src/services/auth.service.ts',
      ]);

      expect(result.branch).toMatch(/^draft\/job-456-fix-auth-bug$/);
      expect(result.commitHash).toBe('abc123');
      expect(mockCheckoutLocalBranch).toHaveBeenCalledWith(result.branch);
    });

    it('should stage all provided files', async () => {
      const files = ['src/schemas/product.schema.ts', 'src/models/product.model.ts'];
      await createDraftBranchAndCommit('/project', 'job-456', 'Fix products', files);

      expect(mockAdd).toHaveBeenCalledWith(files);
    });

    it('should commit with draft prefix and validation note', async () => {
      await createDraftBranchAndCommit('/project', 'job-456', 'Fix auth bug', [
        'src/services/auth.service.ts',
      ]);

      const commitMsg = mockCommit.mock.calls[0]?.[0] as string;
      expect(commitMsg).toContain('draft(builder):');
      expect(commitMsg).toContain('Fix auth bug');
      expect(commitMsg).toContain('NOTE: Validation failed');
      expect(commitMsg).toContain('Co-Authored-By: Claude Opus 4.6');
      expect(commitMsg).toContain('job-456');
    });

    it('should truncate long prompts in commit message', async () => {
      const longPrompt = 'B'.repeat(100);
      await createDraftBranchAndCommit('/project', 'job-456', longPrompt, ['file.ts']);

      const commitMsg = mockCommit.mock.calls[0]?.[0] as string;
      expect(commitMsg).toContain('...');
    });
  });

  describe('pushBranch', () => {
    it('should push to origin with set-upstream', async () => {
      await pushBranch('/project', 'builder/job-123-products');

      expect(mockPush).toHaveBeenCalledWith('origin', 'builder/job-123-products', [
        '--set-upstream',
      ]);
    });
  });

  describe('cleanupBranch', () => {
    it('should checkout main and delete branch', async () => {
      await cleanupBranch('/project', 'builder/test-branch');

      expect(mockCheckout).toHaveBeenCalledWith('main');
      expect(mockDeleteLocalBranch).toHaveBeenCalledWith('builder/test-branch', true);
    });

    it('should not checkout if already on different branch', async () => {
      mockBranch.mockResolvedValueOnce({ current: 'main' });

      await cleanupBranch('/project', 'builder/other-branch');

      expect(mockCheckout).not.toHaveBeenCalled();
      expect(mockDeleteLocalBranch).toHaveBeenCalledWith('builder/other-branch', true);
    });

    it('should not throw if delete fails', async () => {
      mockDeleteLocalBranch.mockRejectedValueOnce(new Error('Branch not found'));

      await expect(cleanupBranch('/project', 'builder/gone')).resolves.toBeUndefined();
    });
  });
});
