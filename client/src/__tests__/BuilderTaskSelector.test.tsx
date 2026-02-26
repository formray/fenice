import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BuilderTaskSelector } from '../components/builder/BuilderTaskSelector';
import { BUILDER_THEME } from '../components/builder/builder-theme';

const theme = BUILDER_THEME.dark;

describe('BuilderTaskSelector', () => {
  it('should render 6 task type pills', () => {
    render(
      <BuilderTaskSelector
        selected="new-resource"
        onSelect={vi.fn()}
        disabled={false}
        theme={theme}
      />
    );
    expect(screen.getByText('New Resource')).toBeDefined();
    expect(screen.getByText('Refactor')).toBeDefined();
    expect(screen.getByText('Bugfix')).toBeDefined();
    expect(screen.getByText('Migration')).toBeDefined();
    expect(screen.getByText('Tests')).toBeDefined();
    expect(screen.getByText('Docs')).toBeDefined();
  });

  it('should call onSelect when pill is clicked', () => {
    const onSelect = vi.fn();
    render(
      <BuilderTaskSelector
        selected="new-resource"
        onSelect={onSelect}
        disabled={false}
        theme={theme}
      />
    );
    fireEvent.click(screen.getByText('Refactor'));
    expect(onSelect).toHaveBeenCalledWith('refactor');
  });

  it('should not call onSelect when disabled', () => {
    const onSelect = vi.fn();
    render(
      <BuilderTaskSelector
        selected="new-resource"
        onSelect={onSelect}
        disabled={true}
        theme={theme}
      />
    );
    fireEvent.click(screen.getByText('Refactor'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
