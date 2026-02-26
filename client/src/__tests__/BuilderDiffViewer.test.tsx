import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BuilderDiffViewer } from '../components/builder/BuilderDiffViewer';
import { BUILDER_THEME } from '../components/builder/builder-theme';

const theme = BUILDER_THEME.dark;

const sampleDiffs = [
  {
    path: 'src/schemas/product.schema.ts',
    diff: `@@ -0,0 +1,5 @@\n+import { z } from 'zod';\n+\n+export const ProductSchema = z.object({\n+  name: z.string(),\n+});`,
  },
  {
    path: 'src/models/product.model.ts',
    diff: '@@ -1,3 +1,5 @@\n import mongoose from "mongoose";\n+import { ProductSchema } from "../schemas/product.schema";\n \n-const old = 1;\n+const schema = new mongoose.Schema({});',
  },
];

describe('BuilderDiffViewer', () => {
  it('should render file paths as accordion headers', () => {
    render(<BuilderDiffViewer diffs={sampleDiffs} theme={theme} />);
    expect(screen.getByText('src/schemas/product.schema.ts')).toBeDefined();
    expect(screen.getByText('src/models/product.model.ts')).toBeDefined();
  });

  it('should be collapsed by default', () => {
    render(<BuilderDiffViewer diffs={sampleDiffs} theme={theme} />);
    expect(screen.queryByText(/import \{ z \} from/)).toBeNull();
  });

  it('should expand when header is clicked', () => {
    render(<BuilderDiffViewer diffs={sampleDiffs} theme={theme} />);
    fireEvent.click(screen.getByText('src/schemas/product.schema.ts'));
    expect(screen.getByText(/import \{ z \} from/)).toBeDefined();
  });

  it('should render nothing when diffs is empty', () => {
    const { container } = render(<BuilderDiffViewer diffs={[]} theme={theme} />);
    expect(container.innerHTML).toBe('');
  });
});
