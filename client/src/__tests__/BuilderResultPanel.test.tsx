import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BuilderResultPanel } from '../components/builder/BuilderResultPanel';
import { BUILDER_THEME } from '../components/builder/builder-theme';

const theme = BUILDER_THEME.dark;

describe('BuilderResultPanel', () => {
  it('should render file list with action badges', () => {
    render(
      <BuilderResultPanel
        files={[
          { path: 'src/schemas/product.schema.ts', content: 'x', action: 'created' },
          { path: 'src/models/product.model.ts', content: 'y', action: 'modified' },
        ]}
        prUrl="https://github.com/formray/fenice/pull/42"
        prNumber={42}
        branch="builder/job-1"
        diffs={null}
        planCoverage={null}
        impactedFiles={null}
        theme={theme}
        visualMode="dark"
      />
    );
    expect(screen.getByText('src/schemas/product.schema.ts')).toBeDefined();
    expect(screen.getByText('created')).toBeDefined();
    expect(screen.getByText('modified')).toBeDefined();
  });

  it('should render PR link when available', () => {
    render(
      <BuilderResultPanel
        files={[]}
        prUrl="https://github.com/formray/fenice/pull/42"
        prNumber={42}
        branch="builder/job-1"
        diffs={null}
        planCoverage={null}
        impactedFiles={null}
        theme={theme}
        visualMode="dark"
      />
    );
    expect(screen.getByText(/View PR #42/)).toBeDefined();
  });

  it('should render plan coverage when provided', () => {
    render(
      <BuilderResultPanel
        files={[]}
        prUrl={null}
        prNumber={null}
        branch={null}
        diffs={null}
        planCoverage={{ planned: ['a.ts', 'b.ts'], generated: ['a.ts'], missing: ['b.ts'] }}
        impactedFiles={null}
        theme={theme}
        visualMode="dark"
      />
    );
    expect(screen.getByText(/1\/2 planned files generated/)).toBeDefined();
    expect(screen.getByText(/Missing:.*b\.ts/)).toBeDefined();
  });

  it('should render impacted files when provided', () => {
    render(
      <BuilderResultPanel
        files={[]}
        prUrl={null}
        prNumber={null}
        branch={null}
        diffs={null}
        planCoverage={null}
        impactedFiles={['src/other.ts', 'src/utils.ts']}
        theme={theme}
        visualMode="dark"
      />
    );
    expect(screen.getByText(/Impacted Files \(2\)/)).toBeDefined();
  });

  it('should not render dry-run sections when data is null', () => {
    const { container } = render(
      <BuilderResultPanel
        files={[{ path: 'a.ts', content: 'x', action: 'created' }]}
        prUrl={null}
        prNumber={null}
        branch={null}
        diffs={null}
        planCoverage={null}
        impactedFiles={null}
        theme={theme}
        visualMode="dark"
      />
    );
    expect(container.textContent).not.toContain('Diffs');
    expect(container.textContent).not.toContain('Plan Coverage');
    expect(container.textContent).not.toContain('Impacted Files');
  });
});
