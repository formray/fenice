import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BuilderDraftResult } from '../components/builder/BuilderDraftResult';
import { BUILDER_THEME } from '../components/builder/builder-theme';

const theme = BUILDER_THEME.dark;

describe('BuilderDraftResult', () => {
  it('should render draft PR message', () => {
    render(
      <BuilderDraftResult
        prUrl="https://github.com/formray/fenice/pull/42"
        prNumber={42}
        branch="draft/job-123-products"
        validationErrors={['typecheck: TS2345']}
        files={[{ path: 'src/test.ts', content: 'x', action: 'created' }]}
        theme={theme}
      />
    );
    expect(screen.getByText(/Draft PR Created/)).toBeDefined();
    expect(screen.getByText(/View PR #42/)).toBeDefined();
  });

  it('should show branch name', () => {
    render(
      <BuilderDraftResult
        prUrl="https://github.com/formray/fenice/pull/42"
        prNumber={42}
        branch="draft/job-123-products"
        validationErrors={[]}
        files={[]}
        theme={theme}
      />
    );
    expect(screen.getByText(/draft\/job-123-products/)).toBeDefined();
  });

  it('should expand validation errors on click', () => {
    render(
      <BuilderDraftResult
        prUrl="https://github.com/formray/fenice/pull/42"
        prNumber={42}
        branch="draft/job-123"
        validationErrors={['typecheck: TS2345', 'lint: 3 errors']}
        files={[]}
        theme={theme}
      />
    );
    fireEvent.click(screen.getByText(/Validation Errors \(2\)/));
    expect(screen.getByText('typecheck: TS2345')).toBeDefined();
    expect(screen.getByText('lint: 3 errors')).toBeDefined();
  });

  it('should render file count', () => {
    render(
      <BuilderDraftResult
        prUrl="url"
        prNumber={1}
        branch="br"
        validationErrors={[]}
        files={[
          { path: 'a.ts', content: 'x', action: 'created' },
          { path: 'b.ts', content: 'y', action: 'modified' },
        ]}
        theme={theme}
      />
    );
    expect(screen.getByText(/Files \(2\)/)).toBeDefined();
  });
});
