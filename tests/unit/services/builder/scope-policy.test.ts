import { describe, it, expect } from 'vitest';
import {
  validateFilePath,
  validateReadPath,
  scanContentForDangerousPatterns,
  checkCodePatterns,
  validateGeneratedFiles,
} from '../../../../src/services/builder/scope-policy.js';

describe('validateFilePath', () => {
  describe('created files', () => {
    it('should allow files in src/schemas/', () => {
      expect(validateFilePath('src/schemas/product.schema.ts', 'created')).toBeNull();
    });

    it('should allow files in src/models/', () => {
      expect(validateFilePath('src/models/product.model.ts', 'created')).toBeNull();
    });

    it('should allow files in src/services/', () => {
      expect(validateFilePath('src/services/product.service.ts', 'created')).toBeNull();
    });

    it('should allow files in src/routes/', () => {
      expect(validateFilePath('src/routes/product.routes.ts', 'created')).toBeNull();
    });

    it('should allow files in tests/', () => {
      expect(validateFilePath('tests/unit/schemas/product.schema.test.ts', 'created')).toBeNull();
    });

    it('should reject files outside allowed directories', () => {
      const result = validateFilePath('src/config/something.ts', 'created');
      expect(result).toContain('not in allowed write directories');
    });

    it('should reject root-level files', () => {
      const result = validateFilePath('hack.ts', 'created');
      expect(result).toContain('not in allowed write directories');
    });
  });

  describe('modified files', () => {
    it('should allow modifying src/index.ts', () => {
      expect(validateFilePath('src/index.ts', 'modified')).toBeNull();
    });

    it('should allow modifying src/routes/mcp.routes.ts', () => {
      expect(validateFilePath('src/routes/mcp.routes.ts', 'modified')).toBeNull();
    });

    it('should allow modifying files in allowed prefixes', () => {
      expect(validateFilePath('src/services/user.service.ts', 'modified')).toBeNull();
      expect(validateFilePath('src/utils/query-builder.ts', 'modified')).toBeNull();
      expect(validateFilePath('tests/unit/something.test.ts', 'modified')).toBeNull();
    });

    it('should reject modifying files outside allowed prefixes', () => {
      const result = validateFilePath('src/config/database.ts', 'modified');
      expect(result).toContain('not in allowed modify list');
    });

    it('should reject modifying forbidden files without plan approval', () => {
      const result = validateFilePath('src/middleware/auth.ts', 'modified');
      expect(result).toContain('Forbidden path');
    });

    it('should allow modifying forbidden files when plan approves them', () => {
      const planPaths = new Set(['src/middleware/auth.ts']);
      const result = validateFilePath('src/middleware/auth.ts', 'modified', planPaths);
      expect(result).toBeNull();
    });

    it('should still reject hard-forbidden files even with plan approval', () => {
      const planPaths = new Set(['.env', 'package.json']);
      expect(validateFilePath('.env', 'modified', planPaths)).toContain('Forbidden path');
      expect(validateFilePath('package.json', 'modified', planPaths)).toContain('Forbidden path');
    });
  });

  describe('forbidden paths', () => {
    it('should reject .env', () => {
      const result = validateFilePath('.env', 'created');
      expect(result).toContain('Forbidden path');
    });

    it('should reject .github/ paths', () => {
      const result = validateFilePath('.github/workflows/ci.yml', 'created');
      expect(result).toContain('Forbidden path');
    });

    it('should reject package.json', () => {
      const result = validateFilePath('package.json', 'created');
      expect(result).toContain('Forbidden path');
    });

    it('should reject tsconfig.json', () => {
      const result = validateFilePath('tsconfig.json', 'created');
      expect(result).toContain('Forbidden path');
    });

    it('should reject node_modules/', () => {
      const result = validateFilePath('node_modules/hack/index.js', 'created');
      expect(result).toContain('Forbidden path');
    });
  });

  describe('path traversal', () => {
    it('should reject paths with ..', () => {
      const result = validateFilePath('src/schemas/../../../etc/passwd', 'created');
      expect(result).toContain('Path traversal');
    });

    it('should reject backslash path traversal', () => {
      const result = validateFilePath('src\\schemas\\..\\..\\etc\\passwd', 'created');
      expect(result).toContain('Path traversal');
    });
  });
});

describe('scanContentForDangerousPatterns', () => {
  it('should detect eval()', () => {
    const violations = scanContentForDangerousPatterns('const x = eval("malicious");');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('eval');
  });

  it('should detect new Function()', () => {
    const violations = scanContentForDangerousPatterns('const fn = new Function("return 1");');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should allow process.env access (standard Node.js pattern)', () => {
    const violations = scanContentForDangerousPatterns('const key = process.env.SECRET;');
    expect(violations).toHaveLength(0);
  });

  it('should detect child_process require', () => {
    const violations = scanContentForDangerousPatterns("require('child_process')");
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should detect child_process import', () => {
    const violations = scanContentForDangerousPatterns("import { exec } from 'child_process'");
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should detect hardcoded Anthropic API keys', () => {
    const violations = scanContentForDangerousPatterns('const key = "sk-ant-abc123def456";');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should detect hardcoded GitHub tokens', () => {
    const violations = scanContentForDangerousPatterns('const token = "ghp_abc123def456ghi";');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should detect private keys', () => {
    const violations = scanContentForDangerousPatterns('-----BEGIN PRIVATE KEY-----');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should allow Mongoose .exec() calls', () => {
    const mongooseCode = `
const users = await UserModel.find({ active: true }).exec();
const count = await UserModel.countDocuments().exec();
`;
    const violations = scanContentForDangerousPatterns(mongooseCode);
    expect(violations).toHaveLength(0);
  });

  it('should still detect standalone exec() calls', () => {
    const violations = scanContentForDangerousPatterns('exec("rm -rf /")');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should pass clean code', () => {
    const cleanCode = `
import { z } from 'zod';

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
});

export type Product = z.infer<typeof ProductSchema>;
`;
    const violations = scanContentForDangerousPatterns(cleanCode);
    expect(violations).toHaveLength(0);
  });
});

describe('validateGeneratedFiles', () => {
  it('should return empty for valid files', () => {
    const violations = validateGeneratedFiles([
      {
        path: 'src/schemas/product.schema.ts',
        content: 'export const ProductSchema = z.object({});',
        action: 'created',
      },
      {
        path: 'src/models/product.model.ts',
        content: 'export const ProductModel = mongoose.model("Product", schema);',
        action: 'created',
      },
    ]);
    expect(violations).toHaveLength(0);
  });

  it('should catch both path and content violations', () => {
    const violations = validateGeneratedFiles([
      {
        path: '.env',
        content: 'SECRET=eval("hack")',
        action: 'created',
      },
    ]);
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });

  it('should validate each file independently', () => {
    const violations = validateGeneratedFiles([
      {
        path: 'src/schemas/good.ts',
        content: 'export const x = 1;',
        action: 'created',
      },
      {
        path: 'package.json',
        content: '{}',
        action: 'created',
      },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe('package.json');
  });
});

describe('checkCodePatterns', () => {
  describe('Zod v4 API checks', () => {
    it('should reject z.string().email()', () => {
      const issues = checkCodePatterns(
        'src/schemas/note.schema.ts',
        'const s = z.string().email();\n'
      );
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain('z.email()');
    });

    it('should reject z.string().url()', () => {
      const issues = checkCodePatterns(
        'src/schemas/note.schema.ts',
        'const s = z.string().url();\n'
      );
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain('z.url()');
    });

    it('should reject z.string().datetime()', () => {
      const issues = checkCodePatterns(
        'src/schemas/note.schema.ts',
        'const s = z.string().datetime();\n'
      );
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain('z.iso.datetime()');
    });

    it('should accept z.email() and z.iso.datetime()', () => {
      const content = `import { z } from 'zod';
export const S = z.object({ email: z.email(), date: z.iso.datetime() });
`;
      const issues = checkCodePatterns('src/schemas/note.schema.ts', content);
      expect(issues).toHaveLength(0);
    });
  });

  describe('import extension checks', () => {
    it('should reject .ts extension in imports', () => {
      const issues = checkCodePatterns(
        'src/routes/note.routes.ts',
        "import { NoteSchema } from '../schemas/note.schema.ts';\n"
      );
      expect(issues.some((i) => i.includes('.js'))).toBe(true);
    });

    it('should reject imports without .js extension', () => {
      const issues = checkCodePatterns(
        'src/routes/note.routes.ts',
        "import { NoteSchema } from '../schemas/note.schema';\n"
      );
      expect(issues.some((i) => i.includes('.js'))).toBe(true);
    });

    it('should accept correct .js extension imports', () => {
      const content = `import { NoteSchema } from '../schemas/note.schema.js';
import { z } from 'zod';
`;
      const issues = checkCodePatterns('src/routes/note.routes.ts', content);
      expect(issues).toHaveLength(0);
    });
  });

  describe('route-specific checks', () => {
    it('should reject authMiddleware import in route files', () => {
      const issues = checkCodePatterns(
        'src/routes/note.routes.ts',
        "import { authMiddleware } from '../middleware/auth.js';\n"
      );
      expect(issues.some((i) => i.includes('authMiddleware'))).toBe(true);
    });

    it('should not flag authMiddleware in non-route files', () => {
      const issues = checkCodePatterns(
        'src/index.ts',
        "import { authMiddleware } from './middleware/auth.js';\n"
      );
      expect(issues).toHaveLength(0);
    });

    it('should reject try/catch in route files', () => {
      const content = `userRouter.openapi(route, async (c) => {
  try {
    const user = await service.findById(id);
  } catch (err) {
    return c.json({ error: 'fail' }, 500);
  }
});
`;
      const issues = checkCodePatterns('src/routes/note.routes.ts', content);
      expect(issues.some((i) => i.includes('try/catch'))).toBe(true);
    });

    it('should not flag try/catch in service files', () => {
      const content = `async findById(id: string) {
  try {
    return await Model.findById(id);
  } catch (err) {
    throw new AppError(500, 'DB_ERROR', 'Database error');
  }
}
`;
      const issues = checkCodePatterns('src/services/note.service.ts', content);
      expect(issues).toHaveLength(0);
    });
  });

  describe('newline check', () => {
    it('should reject files without trailing newline', () => {
      const issues = checkCodePatterns('src/schemas/note.schema.ts', 'export const x = 1;');
      expect(issues.some((i) => i.includes('newline'))).toBe(true);
    });

    it('should accept files with trailing newline', () => {
      const issues = checkCodePatterns('src/schemas/note.schema.ts', 'export const x = 1;\n');
      expect(issues).toHaveLength(0);
    });
  });
});

describe('validateReadPath', () => {
  describe('allowed read paths', () => {
    it('should allow src/ files', () => {
      expect(validateReadPath('src/schemas/user.schema.ts')).toBeNull();
      expect(validateReadPath('src/services/auth.service.ts')).toBeNull();
      expect(validateReadPath('src/index.ts')).toBeNull();
    });

    it('should allow tests/ files', () => {
      expect(validateReadPath('tests/unit/schemas/user.schema.test.ts')).toBeNull();
      expect(validateReadPath('tests/integration/auth.test.ts')).toBeNull();
    });

    it('should allow CLAUDE.md', () => {
      expect(validateReadPath('CLAUDE.md')).toBeNull();
    });

    it('should allow package.json', () => {
      expect(validateReadPath('package.json')).toBeNull();
    });

    it('should allow tsconfig.json', () => {
      expect(validateReadPath('tsconfig.json')).toBeNull();
    });
  });

  describe('forbidden read paths', () => {
    it('should block .env', () => {
      const result = validateReadPath('.env');
      expect(result).toContain('Forbidden read path');
    });

    it('should block .env.local and similar', () => {
      const result = validateReadPath('.env.local');
      expect(result).toContain('Forbidden read path');
    });

    it('should block node_modules/', () => {
      const result = validateReadPath('node_modules/express/index.js');
      expect(result).toContain('Forbidden read path');
    });

    it('should block .git/', () => {
      const result = validateReadPath('.git/config');
      expect(result).toContain('Forbidden read path');
    });

    it('should block dist/', () => {
      const result = validateReadPath('dist/server.js');
      expect(result).toContain('Forbidden read path');
    });

    it('should block .github/', () => {
      const result = validateReadPath('.github/workflows/ci.yml');
      expect(result).toContain('Forbidden read path');
    });
  });

  describe('path traversal', () => {
    it('should block path traversal with ..', () => {
      const result = validateReadPath('../../../etc/passwd');
      expect(result).toContain('Path traversal');
    });

    it('should block path traversal with backslash normalization', () => {
      const result = validateReadPath('src\\..\\..\\etc\\passwd');
      expect(result).toContain('Path traversal');
    });
  });

  describe('paths outside allowed prefixes', () => {
    it('should block arbitrary root files', () => {
      const result = validateReadPath('hack.ts');
      expect(result).toContain('not in allowed read directories');
    });

    it('should block docker files', () => {
      const result = validateReadPath('docker-compose.yml');
      expect(result).toContain('not in allowed read directories');
    });
  });
});
