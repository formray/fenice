import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCheckoutLocalBranch = vi.fn();
const mockAdd = vi.fn();
const mockCommit = vi.fn().mockResolvedValue({ commit: 'abc123' });
const mockPush = vi.fn();
const mockCheckout = vi.fn();
const mockDeleteLocalBranch = vi.fn();
const mockBranch = vi.fn().mockResolvedValue({ current: 'builder/test-branch' });
const mockRemote = vi.fn();
const mockRaw = vi.fn().mockResolvedValue('');

vi.mock('simple-git', () => ({
  simpleGit: () => ({
    checkoutLocalBranch: (...args: unknown[]) => mockCheckoutLocalBranch(...args),
    add: (...args: unknown[]) => mockAdd(...args),
    commit: (...args: unknown[]) => mockCommit(...args),
    push: (...args: unknown[]) => mockPush(...args),
    checkout: (...args: unknown[]) => mockCheckout(...args),
    deleteLocalBranch: (...args: unknown[]) => mockDeleteLocalBranch(...args),
    branch: (...args: unknown[]) => mockBranch(...args),
    remote: (...args: unknown[]) => mockRemote(...args),
    raw: (...args: unknown[]) => mockRaw(...args),
  }),
}));

vi.mock('node:fs/promises', () => ({
  mkdtemp: vi.fn().mockResolvedValue('/tmp/fenice-builder-abc123'),
  rm: vi.fn().mockResolvedValue(undefined),
  symlink: vi.fn().mockResolvedValue(undefined),
}));

const {
  createBranchAndCommit,
  createDraftBranchAndCommit,
  amendCommitWithFiles,
  pushBranch,
  cleanupBranch,
  parseGitHubUrl,
  detectGitHubRemote,
  createWorktree,
  createDraftWorktree,
  commitInWorktree,
  pushFromWorktree,
  removeWorktree,
  commitToMain,
  revertCommit,
} = await import('../../../../src/services/builder/git-ops.js');

describe('git-ops', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommit.mockResolvedValue({ commit: 'abc123' });
    mockBranch.mockResolvedValue({ current: 'builder/test-branch' });
  });

  describe('parseGitHubUrl', () => {
    it('should parse HTTPS URL', () => {
      const result = parseGitHubUrl('https://github.com/formray/fenice.git');
      expect(result).toEqual({ owner: 'formray', repo: 'fenice' });
    });

    it('should parse HTTPS URL without .git suffix', () => {
      const result = parseGitHubUrl('https://github.com/mario-rossi/my-project');
      expect(result).toEqual({ owner: 'mario-rossi', repo: 'my-project' });
    });

    it('should parse SSH URL', () => {
      const result = parseGitHubUrl('git@github.com:formray/fenice.git');
      expect(result).toEqual({ owner: 'formray', repo: 'fenice' });
    });

    it('should parse SSH URL without .git suffix', () => {
      const result = parseGitHubUrl('git@github.com:mario-rossi/my-project');
      expect(result).toEqual({ owner: 'mario-rossi', repo: 'my-project' });
    });

    it('should return null for non-GitHub URL', () => {
      expect(parseGitHubUrl('https://gitlab.com/user/repo.git')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseGitHubUrl('')).toBeNull();
    });
  });

  describe('detectGitHubRemote', () => {
    it('should detect owner/repo from origin remote', async () => {
      mockRemote.mockResolvedValue('https://github.com/mario-rossi/fenice.git\n');

      const result = await detectGitHubRemote('/project');
      expect(result).toEqual({ owner: 'mario-rossi', repo: 'fenice' });
      expect(mockRemote).toHaveBeenCalledWith(['get-url', 'origin']);
    });

    it('should return null if remote call fails', async () => {
      mockRemote.mockRejectedValue(new Error('not a git repo'));

      const result = await detectGitHubRemote('/project');
      expect(result).toBeNull();
    });

    it('should return null for non-GitHub remote', async () => {
      mockRemote.mockResolvedValue('https://gitlab.com/user/repo.git\n');

      const result = await detectGitHubRemote('/project');
      expect(result).toBeNull();
    });
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

    it('should commit with conventional commit message and --no-verify', async () => {
      await createBranchAndCommit('/project', 'job-123', 'Add a products endpoint', [
        'src/schemas/product.schema.ts',
      ]);

      const commitMsg = mockCommit.mock.calls[0]?.[0] as string;
      expect(commitMsg).toContain('feat(builder):');
      expect(commitMsg).toContain('Add a products endpoint');
      expect(commitMsg).toContain('Co-Authored-By: Claude Opus 4.6');
      expect(commitMsg).toContain('job-123');
      // Must bypass pre-commit hooks — builder has its own validation step
      expect(mockCommit.mock.calls[0]?.[2]).toEqual({ '--no-verify': null });
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

  describe('amendCommitWithFiles', () => {
    it('should stage files and amend commit with --no-verify --no-edit', async () => {
      await amendCommitWithFiles('/project', [
        'src/routes/note.routes.ts',
        'src/schemas/note.schema.ts',
      ]);

      expect(mockAdd).toHaveBeenCalledWith([
        'src/routes/note.routes.ts',
        'src/schemas/note.schema.ts',
      ]);
      expect(mockCommit).toHaveBeenCalledWith('fix: apply repair', undefined, {
        '--amend': null,
        '--no-verify': null,
        '--no-edit': null,
      });
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

    it('should commit with draft prefix, validation note, and --no-verify', async () => {
      await createDraftBranchAndCommit('/project', 'job-456', 'Fix auth bug', [
        'src/services/auth.service.ts',
      ]);

      const commitMsg = mockCommit.mock.calls[0]?.[0] as string;
      expect(commitMsg).toContain('draft(builder):');
      expect(commitMsg).toContain('Fix auth bug');
      expect(commitMsg).toContain('NOTE: Validation failed');
      expect(commitMsg).toContain('Co-Authored-By: Claude Opus 4.6');
      expect(commitMsg).toContain('job-456');
      expect(mockCommit.mock.calls[0]?.[2]).toEqual({ '--no-verify': null });
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
    it('should force-checkout main and delete branch', async () => {
      await cleanupBranch('/project', 'builder/test-branch');

      expect(mockCheckout).toHaveBeenCalledWith(['--force', 'main']);
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

  describe('createWorktree', () => {
    it('should create a worktree with builder branch', async () => {
      const result = await createWorktree('/project', 'job-789', 'Add notes endpoint');

      expect(result.branch).toMatch(/^builder\/job-789-add-notes-endpoint$/);
      expect(result.worktreePath).toBe('/tmp/fenice-builder-abc123');
      expect(mockRaw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        result.branch,
        '/tmp/fenice-builder-abc123',
        'HEAD',
      ]);
    });
  });

  describe('createDraftWorktree', () => {
    it('should create a worktree with draft branch', async () => {
      const result = await createDraftWorktree('/project', 'job-789', 'Fix auth');

      expect(result.branch).toMatch(/^draft\/job-789-fix-auth$/);
      expect(result.worktreePath).toBe('/tmp/fenice-builder-abc123');
      expect(mockRaw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        result.branch,
        '/tmp/fenice-builder-abc123',
        'HEAD',
      ]);
    });
  });

  describe('commitInWorktree', () => {
    it('should stage files and commit in worktree', async () => {
      const hash = await commitInWorktree('/tmp/fenice-builder-abc123', 'job-789', 'Add notes', [
        'src/schemas/note.schema.ts',
      ]);

      expect(hash).toBe('abc123');
      expect(mockAdd).toHaveBeenCalledWith(['src/schemas/note.schema.ts']);
      const commitMsg = mockCommit.mock.calls[0]?.[0] as string;
      expect(commitMsg).toContain('feat(builder):');
      expect(commitMsg).toContain('Co-Authored-By: Claude Opus 4.6');
    });

    it('should use draft prefix when isDraft is true', async () => {
      await commitInWorktree('/tmp/wt', 'job-789', 'Fix bug', ['file.ts'], true);

      const commitMsg = mockCommit.mock.calls[0]?.[0] as string;
      expect(commitMsg).toContain('draft(builder):');
      expect(commitMsg).toContain('NOTE: Validation failed');
    });
  });

  describe('pushFromWorktree', () => {
    it('should push to origin from worktree', async () => {
      await pushFromWorktree('/tmp/fenice-builder-abc123', 'builder/job-789-add-notes');

      expect(mockPush).toHaveBeenCalledWith('origin', 'builder/job-789-add-notes', [
        '--set-upstream',
      ]);
    });
  });

  describe('removeWorktree', () => {
    it('should remove worktree and delete branch', async () => {
      await removeWorktree('/project', '/tmp/fenice-builder-abc123', 'builder/job-789-add-notes');

      expect(mockRaw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/tmp/fenice-builder-abc123',
        '--force',
      ]);
      expect(mockDeleteLocalBranch).toHaveBeenCalledWith('builder/job-789-add-notes', true);
    });

    it('should not throw if worktree remove fails', async () => {
      mockRaw.mockRejectedValueOnce(new Error('not a worktree'));

      await expect(
        removeWorktree('/project', '/tmp/gone', 'builder/gone')
      ).resolves.toBeUndefined();
    });
  });

  describe('commitToMain', () => {
    it('should stage files and commit on current branch', async () => {
      const hash = await commitToMain('/project', 'job-100', 'Add tasks endpoint', [
        'src/schemas/task.schema.ts',
        'src/models/task.model.ts',
      ]);

      expect(hash).toBe('abc123');
      expect(mockAdd).toHaveBeenCalledWith([
        'src/schemas/task.schema.ts',
        'src/models/task.model.ts',
      ]);
      const commitMsg = mockCommit.mock.calls[0]?.[0] as string;
      expect(commitMsg).toContain('feat(builder):');
      expect(commitMsg).toContain('Add tasks endpoint');
      expect(commitMsg).toContain('Co-Authored-By: Claude Opus 4.6');
      expect(commitMsg).toContain('job-100');
      expect(mockCommit.mock.calls[0]?.[2]).toEqual({ '--no-verify': null });
    });

    it('should truncate long prompts', async () => {
      await commitToMain('/project', 'job-100', 'A'.repeat(100), ['file.ts']);
      const commitMsg = mockCommit.mock.calls[0]?.[0] as string;
      expect(commitMsg).toContain('...');
    });
  });

  describe('revertCommit', () => {
    it('should revert the specified commit', async () => {
      const hash = await revertCommit('/project', 'abc123');

      expect(hash).toBe('abc123');
      expect(mockRaw).toHaveBeenCalledWith(['revert', 'abc123', '--no-edit', '--no-verify']);
    });
  });
});
