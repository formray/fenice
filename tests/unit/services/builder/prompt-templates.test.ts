import { describe, it, expect } from 'vitest';
import type { TaskType } from '../../../../src/schemas/builder.schema.js';
import {
  BUILDER_SYSTEM_PROMPT,
  BUILDER_PLAN_PROMPT,
  BUILDER_TOOLS,
  BUILDER_BASE_PROMPT,
  TASK_PROMPTS,
  buildSystemPrompt,
  buildPlanPrompt,
  buildPlanConstraint,
} from '../../../../src/services/builder/prompt-templates.js';

const ALL_TASK_TYPES: TaskType[] = [
  'new-resource',
  'refactor',
  'bugfix',
  'schema-migration',
  'test-gen',
  'doc-gen',
];

describe('BUILDER_BASE_PROMPT', () => {
  it('should contain tech stack information', () => {
    expect(BUILDER_BASE_PROMPT).toContain('Node.js');
    expect(BUILDER_BASE_PROMPT).toContain('TypeScript');
    expect(BUILDER_BASE_PROMPT).toContain('Hono');
    expect(BUILDER_BASE_PROMPT).toContain('Zod');
    expect(BUILDER_BASE_PROMPT).toContain('Mongoose');
  });

  it('should contain critical rules', () => {
    expect(BUILDER_BASE_PROMPT).toContain('.js');
    expect(BUILDER_BASE_PROMPT).toContain('exactOptionalPropertyTypes');
    expect(BUILDER_BASE_PROMPT).toContain('loadEnv');
  });

  it('should contain naming conventions', () => {
    expect(BUILDER_BASE_PROMPT).toContain('kebab-case');
    expect(BUILDER_BASE_PROMPT).toContain('PascalCase');
    expect(BUILDER_BASE_PROMPT).toContain('camelCase');
  });
});

describe('TASK_PROMPTS', () => {
  it('should have entries for all 6 task types', () => {
    for (const taskType of ALL_TASK_TYPES) {
      expect(TASK_PROMPTS).toHaveProperty(taskType);
      expect(TASK_PROMPTS[taskType].length).toBeGreaterThan(0);
    }
  });
});

describe('buildSystemPrompt', () => {
  it('should include base conventions for ALL 6 task types', () => {
    for (const taskType of ALL_TASK_TYPES) {
      const prompt = buildSystemPrompt(taskType);
      expect(prompt).toContain('Node.js');
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('.js');
      expect(prompt).toContain('kebab-case');
    }
  });

  it('should include CRUD, schema, model, service, route for new-resource', () => {
    const prompt = buildSystemPrompt('new-resource');
    expect(prompt).toContain('CRUD');
    expect(prompt).toContain('schema');
    expect(prompt).toContain('model');
    expect(prompt).toContain('service');
    expect(prompt).toContain('route');
  });

  it('should mention all 5 endpoints for new-resource', () => {
    const prompt = buildSystemPrompt('new-resource');
    expect(prompt).toMatch(/GET.*list/i);
    expect(prompt).toMatch(/GET.*:id/i);
    expect(prompt).toContain('POST');
    expect(prompt).toContain('PATCH');
    expect(prompt).toContain('DELETE');
  });

  it('should mention refactor for refactor task type', () => {
    const prompt = buildSystemPrompt('refactor');
    expect(prompt.toLowerCase()).toContain('refactor');
    expect(prompt.toLowerCase()).toContain('preserv');
  });

  it('should mention test for test-gen task type', () => {
    const prompt = buildSystemPrompt('test-gen');
    expect(prompt.toLowerCase()).toContain('test');
    expect(prompt).toContain('vi.mock');
  });

  it('should mention bugfix for bugfix task type', () => {
    const prompt = buildSystemPrompt('bugfix');
    expect(prompt.toLowerCase()).toContain('bug');
    expect(prompt.toLowerCase()).toContain('root cause');
  });

  it('should mention migration for schema-migration task type', () => {
    const prompt = buildSystemPrompt('schema-migration');
    expect(prompt.toLowerCase()).toContain('backward compat');
    expect(prompt.toLowerCase()).toContain('zod');
    expect(prompt.toLowerCase()).toContain('mongoose');
  });

  it('should mention docs for doc-gen task type', () => {
    const prompt = buildSystemPrompt('doc-gen');
    expect(prompt.toLowerCase()).toContain('claude.md');
    expect(prompt.toLowerCase()).toContain('openapi');
  });

  it('should return different prompts for different task types', () => {
    const newResource = buildSystemPrompt('new-resource');
    const refactor = buildSystemPrompt('refactor');
    const bugfix = buildSystemPrompt('bugfix');
    expect(newResource).not.toBe(refactor);
    expect(refactor).not.toBe(bugfix);
  });
});

describe('buildPlanPrompt', () => {
  it('should include file index when provided', () => {
    const fileIndex = 'src/schemas/user.schema.ts\nsrc/models/user.model.ts';
    const prompt = buildPlanPrompt(fileIndex);
    expect(prompt).toContain('user.schema.ts');
    expect(prompt).toContain('user.model.ts');
  });

  it('should instruct to output contextFiles and taskType', () => {
    const prompt = buildPlanPrompt('');
    expect(prompt).toContain('contextFiles');
    expect(prompt).toContain('taskType');
  });

  it('should not include file index section when empty string is passed', () => {
    const promptEmpty = buildPlanPrompt('');
    const promptWithIndex = buildPlanPrompt('src/schemas/foo.ts');
    // The one with index should be longer
    expect(promptWithIndex.length).toBeGreaterThan(promptEmpty.length);
  });

  it('should contain project structure conventions', () => {
    const prompt = buildPlanPrompt('');
    expect(prompt).toContain('schema');
    expect(prompt).toContain('model');
    expect(prompt).toContain('service');
    expect(prompt).toContain('route');
    expect(prompt).toContain('JSON');
  });
});

describe('BUILDER_TOOLS', () => {
  it('should have exactly 3 tools', () => {
    expect(BUILDER_TOOLS).toHaveLength(3);
  });

  it('should contain write_file, modify_file, and read_file', () => {
    const toolNames = BUILDER_TOOLS.map((t) => t.name);
    expect(toolNames).toContain('write_file');
    expect(toolNames).toContain('modify_file');
    expect(toolNames).toContain('read_file');
  });
});

describe('BUILDER_SYSTEM_PROMPT (legacy)', () => {
  it('should equal buildSystemPrompt("new-resource")', () => {
    expect(BUILDER_SYSTEM_PROMPT).toBe(buildSystemPrompt('new-resource'));
  });
});

describe('BUILDER_PLAN_PROMPT (legacy)', () => {
  it('should equal buildPlanPrompt("")', () => {
    expect(BUILDER_PLAN_PROMPT).toBe(buildPlanPrompt(''));
  });
});

describe('buildPlanConstraint', () => {
  it('should format plan files into numbered list', () => {
    const result = buildPlanConstraint({
      files: [
        { path: 'src/schemas/product.schema.ts', action: 'create', description: 'Zod schema' },
        { path: 'src/models/product.model.ts', action: 'create', description: 'Mongoose model' },
      ],
    });
    expect(result).toContain('1. src/schemas/product.schema.ts (create)');
    expect(result).toContain('2. src/models/product.model.ts (create)');
    expect(result).toContain('Approved Plan');
  });
});
