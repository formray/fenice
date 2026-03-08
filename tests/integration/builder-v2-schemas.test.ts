import { describe, it, expect } from 'vitest';
import {
  BuilderOptionsSchema,
  BuilderPlanSchema,
  BuilderJobResultSchema,
  BuilderJobStatusEnum,
  TaskTypeEnum,
} from '../../src/schemas/builder.schema.js';

describe('Builder v2 integration', () => {
  describe('TaskType support', () => {
    it('should accept all 6 task types', () => {
      const types = [
        'new-resource',
        'refactor',
        'bugfix',
        'schema-migration',
        'test-gen',
        'doc-gen',
      ];
      for (const t of types) {
        const result = TaskTypeEnum.safeParse(t);
        expect(result.success).toBe(true);
      }
    });

    it('should accept taskType in BuilderOptionsSchema', () => {
      const result = BuilderOptionsSchema.safeParse({
        dryRun: true,
        includeModel: true,
        includeTests: true,
        taskType: 'refactor',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid taskType', () => {
      const result = TaskTypeEnum.safeParse('invalid-type');
      expect(result.success).toBe(false);
    });
  });

  describe('Plan enrichment', () => {
    it('should accept contextFiles and taskType in plan', () => {
      const result = BuilderPlanSchema.safeParse({
        summary: 'Test plan',
        files: [{ path: 'src/a.ts', type: 'schema', action: 'create', description: 'A' }],
        contextFiles: ['src/schemas/user.schema.ts'],
        taskType: 'new-resource',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contextFiles).toEqual(['src/schemas/user.schema.ts']);
        expect(result.data.taskType).toBe('new-resource');
      }
    });

    it('should accept plan without contextFiles (backward compat)', () => {
      const result = BuilderPlanSchema.safeParse({
        summary: 'Test plan',
        files: [{ path: 'src/a.ts', type: 'schema', action: 'create', description: 'A' }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Enriched job result', () => {
    it('should accept result with diffs, planCoverage, impactedFiles, tokenUsage', () => {
      const result = BuilderJobResultSchema.safeParse({
        files: [{ path: 'src/a.ts', content: 'const x = 1;', action: 'created' }],
        validationPassed: true,
        diffs: [{ path: 'src/a.ts', diff: '+const x = 1;' }],
        planCoverage: {
          planned: ['src/a.ts'],
          generated: ['src/a.ts'],
          missing: [],
        },
        impactedFiles: ['src/index.ts'],
        tokenUsage: { inputTokens: 1000, outputTokens: 500 },
      });
      expect(result.success).toBe(true);
    });

    it('should accept result with validationErrors (draft)', () => {
      const result = BuilderJobResultSchema.safeParse({
        files: [{ path: 'src/a.ts', content: 'const x = 1;', action: 'created' }],
        validationPassed: false,
        validationErrors: ['typecheck: TS2345 ...', 'lint: no-unused-vars ...'],
        tokenUsage: { inputTokens: 2000, outputTokens: 1000 },
      });
      expect(result.success).toBe(true);
    });

    it('should accept result with M5 repair metadata', () => {
      const result = BuilderJobResultSchema.safeParse({
        files: [{ path: 'src/a.ts', content: 'const x = 1;', action: 'created' }],
        validationPassed: false,
        validationErrors: ['typecheck: TS2345'],
        repairAttempts: 3,
        repairStrategies: ['typecheck', 'lint', 'all'],
        tokenUsage: { inputTokens: 5000, outputTokens: 2500 },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.repairAttempts).toBe(3);
        expect(result.data.repairStrategies).toEqual(['typecheck', 'lint', 'all']);
      }
    });

    it('should accept minimal result (backward compat)', () => {
      const result = BuilderJobResultSchema.safeParse({
        files: [{ path: 'src/a.ts', content: 'const x = 1;', action: 'created' }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('completed_draft status', () => {
    it('should include completed_draft in status enum', () => {
      const result = BuilderJobStatusEnum.safeParse('completed_draft');
      expect(result.success).toBe(true);
    });
  });
});
