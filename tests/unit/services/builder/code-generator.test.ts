import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Anthropic SDK
const mockCreate = vi.fn();

class MockAnthropic {
  messages = {
    create: (...args: unknown[]) => mockCreate(...args),
  };
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropic,
}));

// Mock fs for read_file tool + in-loop validation (writeFilesToDisk / cleanupFiles / worktree)
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockImplementation(async (path: string) => {
    if (path === '/project/src/index.ts') {
      return 'export const app = new OpenAPIHono();';
    }
    throw new Error('File not found');
  }),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  mkdtemp: vi.fn().mockResolvedValue('/tmp/fenice-validate-test'),
  unlink: vi.fn().mockResolvedValue(undefined),
  symlink: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// Mock child_process for in-loop validation (runValidationSteps)
type ExecFileCallback = (err: Error | null, stdout: string, stderr: string) => void;
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: ExecFileCallback) => {
    cb(null, '', '');
  }),
}));

// Mock node:util promisify to work with our mock
vi.mock('node:util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:util')>();
  return {
    ...actual,
    promisify: (fn: (...args: unknown[]) => void) => {
      return async (...args: unknown[]) => {
        return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
          fn(...args, (err: Error | null, stdout: string, stderr: string) => {
            if (err) reject(err);
            else resolve({ stdout, stderr });
          });
        });
      };
    },
  };
});

const { generateCode, generatePlan, repairCode } =
  await import('../../../../src/services/builder/code-generator.js');

const mockContext = {
  openApiSpec: '{"openapi": "3.1.0"}',
  projectConventions: '# CLAUDE.md',
  exampleSchema: 'export const UserSchema = z.object({});',
  exampleModel: 'export const UserModel = mongoose.model("User");',
  exampleService: 'export class UserService {}',
  exampleRoute: 'export const userRouter = new OpenAPIHono();',
};

describe('generateCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return files generated via tool use', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'write_file',
          input: {
            path: 'src/schemas/product.schema.ts',
            content: "import { z } from 'zod';\nexport const ProductSchema = z.object({});\n",
          },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Done generating files.' }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });

    const result = await generateCode(
      'Add a products endpoint',
      mockContext,
      '/project',
      'sk-test-key'
    );

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.path).toBe('src/schemas/product.schema.ts');
    expect(result.files[0]?.action).toBe('created');
    expect(result.violations).toHaveLength(0);
    expect(result.tokenUsage.inputTokens).toBe(180);
    expect(result.tokenUsage.outputTokens).toBe(70);
  });

  it('should record violations for forbidden paths', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'write_file',
          input: {
            path: '.env',
            content: 'SECRET=hack',
          },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Done.' }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });

    const result = await generateCode(
      'Add a products endpoint',
      mockContext,
      '/project',
      'sk-test-key'
    );

    expect(result.files).toHaveLength(0);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.reason).toContain('Forbidden path');
  });

  it('should record violations for dangerous content', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'write_file',
          input: {
            path: 'src/schemas/evil.schema.ts',
            content: 'const x = eval("dangerous");',
          },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Done.' }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });

    const result = await generateCode(
      'Add a products endpoint',
      mockContext,
      '/project',
      'sk-test-key'
    );

    expect(result.files).toHaveLength(0);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]?.reason).toContain('Dangerous pattern');
  });

  it('should handle read_file tool calls', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'read_file',
          input: { path: 'src/index.ts' },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Done.' }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });

    const result = await generateCode(
      'Read the index file',
      mockContext,
      '/project',
      'sk-test-key'
    );

    expect(result.files).toHaveLength(0);
    expect(result.violations).toHaveLength(0);

    // Verify the second call included the file content as tool result
    expect(mockCreate).toHaveBeenCalledTimes(2);
    const secondCallMessages = (mockCreate.mock.calls[1] as Record<string, unknown>[])[0]?.[
      'messages'
    ] as { role: string; content: unknown }[];
    const lastMessage = secondCallMessages[secondCallMessages.length - 1];
    expect(lastMessage?.role).toBe('user');
  });

  it('should handle modify_file for allowed files', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'modify_file',
          input: {
            path: 'src/index.ts',
            content: 'export const app = new OpenAPIHono();\n// modified\n',
          },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Done.' }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });

    const result = await generateCode('Modify index.ts', mockContext, '/project', 'sk-test-key');

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.action).toBe('modified');
    expect(result.files[0]?.path).toBe('src/index.ts');
    expect(result.violations).toHaveLength(0);
  });

  it('should reject modify_file for non-allowed files', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'modify_file',
          input: {
            path: 'src/config/database.ts',
            content: '// modified',
          },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Done.' }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });

    const result = await generateCode(
      'Modify user service',
      mockContext,
      '/project',
      'sk-test-key'
    );

    expect(result.files).toHaveLength(0);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.reason).toContain('not in allowed modify list');
  });

  it('should handle multiple tool calls in one turn', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'write_file',
          input: {
            path: 'src/schemas/product.schema.ts',
            content: 'export const ProductSchema = z.object({});\n',
          },
        },
        {
          type: 'tool_use',
          id: 'tool-2',
          name: 'write_file',
          input: {
            path: 'src/models/product.model.ts',
            content: 'export const ProductModel = mongoose.model("Product");\n',
          },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 80 },
    });

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Done.' }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });

    const result = await generateCode(
      'Add a products endpoint',
      mockContext,
      '/project',
      'sk-test-key'
    );

    expect(result.files).toHaveLength(2);
    expect(result.files[0]?.path).toBe('src/schemas/product.schema.ts');
    expect(result.files[1]?.path).toBe('src/models/product.model.ts');
  });

  it('should throw LLM_API_ERROR when Anthropic API fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'));

    await expect(
      generateCode('Add a products endpoint', mockContext, '/project', 'sk-test-key')
    ).rejects.toThrow('Claude API error: Rate limit exceeded');
  });
});

describe('generatePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return parsed plan from Claude JSON response', async () => {
    const plan = {
      summary: 'Generate a product CRUD API',
      files: [
        {
          path: 'src/schemas/product.schema.ts',
          type: 'schema',
          action: 'create',
          description: 'Zod schema for product',
        },
        {
          path: 'src/models/product.model.ts',
          type: 'model',
          action: 'create',
          description: 'Mongoose model for product',
        },
      ],
    };

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(plan) }],
      usage: { input_tokens: 500, output_tokens: 100 },
    });

    const result = await generatePlan('Create a product CRUD', mockContext, 'test-api-key');
    expect(result.plan.summary).toBe('Generate a product CRUD API');
    expect(result.plan.files).toHaveLength(2);
    expect(result.plan.files[0]?.type).toBe('schema');
    expect(result.tokenUsage.inputTokens).toBe(500);
    expect(result.tokenUsage.outputTokens).toBe(100);
  });

  it('should throw PLAN_PARSE_ERROR on invalid JSON response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'This is not JSON' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    await expect(generatePlan('Create something', mockContext, 'key')).rejects.toMatchObject({
      code: 'PLAN_PARSE_ERROR',
      message: 'Claude returned invalid JSON for the plan',
    });
  });

  it('should throw PLAN_PARSE_ERROR on plan with empty files', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ summary: 'x', files: [] }) }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    await expect(generatePlan('Create something', mockContext, 'key')).rejects.toMatchObject({
      code: 'PLAN_PARSE_ERROR',
      message: 'Claude returned a plan that does not match the expected schema',
    });
  });

  it('should handle JSON wrapped in markdown code fences', async () => {
    const plan = {
      summary: 'Generate a product API',
      files: [
        {
          path: 'src/schemas/product.schema.ts',
          type: 'schema',
          action: 'create',
          description: 'Schema',
        },
      ],
    };

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '```json\n' + JSON.stringify(plan) + '\n```' }],
      usage: { input_tokens: 200, output_tokens: 80 },
    });

    const result = await generatePlan('Create product', mockContext, 'key');
    expect(result.plan.summary).toBe('Generate a product API');
    expect(result.plan.files).toHaveLength(1);
  });

  it('should throw LLM_API_ERROR when Anthropic API fails during planning', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Service unavailable'));

    await expect(generatePlan('Create something', mockContext, 'key')).rejects.toThrow(
      'Claude API error during planning'
    );
  });

  it('should throw PLAN_PARSE_ERROR when response has no text block', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'x', name: 'foo', input: {} }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    await expect(generatePlan('Create something', mockContext, 'key')).rejects.toMatchObject({
      code: 'PLAN_PARSE_ERROR',
    });
  });
});

describe('generateCode with plan constraint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include plan constraint in user message when plan is provided', async () => {
    const plan = {
      summary: 'Generate a product API',
      files: [
        {
          path: 'src/schemas/product.schema.ts',
          type: 'schema' as const,
          action: 'create' as const,
          description: 'Zod schema',
        },
      ],
    };

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Done.' }],
      usage: { input_tokens: 100, output_tokens: 20 },
    });

    await generateCode(
      'Add a products endpoint',
      mockContext,
      '/project',
      'sk-test-key',
      undefined,
      plan
    );

    const firstCallArgs = mockCreate.mock.calls[0] as Record<string, unknown>[];
    const messages = (firstCallArgs[0] as { messages: { content: string }[] }).messages;
    expect(messages[0]?.content).toContain('Approved Plan');
    expect(messages[0]?.content).toContain('src/schemas/product.schema.ts');
  });

  it('should not include plan constraint when plan is not provided', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Done.' }],
      usage: { input_tokens: 100, output_tokens: 20 },
    });

    await generateCode('Add a products endpoint', mockContext, '/project', 'sk-test-key');

    const firstCallArgs = mockCreate.mock.calls[0] as Record<string, unknown>[];
    const messages = (firstCallArgs[0] as { messages: { content: string }[] }).messages;
    expect(messages[0]?.content).not.toContain('Approved Plan');
  });
});

describe('repairCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send validation errors and original files to Claude', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'write_file',
          input: {
            path: 'src/schemas/product.schema.ts',
            content:
              "import { z } from 'zod';\nexport const ProductSchema = z.object({ id: z.string() });\n",
          },
        },
      ],
      usage: { input_tokens: 200, output_tokens: 100 },
    });

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Fixed.' }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });

    const originalFiles = [
      {
        path: 'src/schemas/product.schema.ts',
        content: 'export const ProductSchema = z.object({});',
        action: 'created' as const,
      },
    ];

    const result = await repairCode(
      originalFiles,
      'error TS2345: Type mismatch',
      '/project',
      'sk-test-key'
    );

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.content).toContain('id: z.string()');
    expect(result.violations).toHaveLength(0);

    // Verify the prompt included the error and original files
    const firstCallArgs = mockCreate.mock.calls[0] as Record<string, unknown>[];
    const messages = (firstCallArgs[0] as { messages: { content: string }[] }).messages;
    expect(messages[0]?.content).toContain('TS2345');
    expect(messages[0]?.content).toContain('product.schema.ts');
  });

  it('should reject scope violations during repair', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'write_file',
          input: {
            path: 'package.json',
            content: '{}',
          },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Done.' }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });

    const result = await repairCode([], 'some error', '/project', 'sk-test-key');

    expect(result.files).toHaveLength(0);
    expect(result.violations).toHaveLength(1);
  });
});
