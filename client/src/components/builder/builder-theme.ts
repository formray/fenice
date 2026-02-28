import type { BuilderJobStatus } from '../../types/builder';

export const BUILDER_THEME = {
  dark: {
    pillBg: 'rgba(12, 20, 42, 0.82)',
    pillBorder: '#2f4670',
    pillText: '#d8e6ff',
    panelBg: 'rgba(10, 10, 20, 0.95)',
    panelBorder: '#2a2a3e',
    text: '#e0e0e0',
    muted: '#888',
    inputBg: 'rgba(255, 255, 255, 0.06)',
    inputBorder: '#2a2a3e',
    inputText: '#e0e0e0',
    buttonBg: '#2563eb',
    buttonText: '#fff',
    buttonDisabled: '#1e3a5f',
    errorText: '#ff6b6b',
    successText: '#50c878',
    badgeCreated: '#2563eb',
    badgeModified: '#f59e0b',
    close: '#888',
    progressBg: 'rgba(255, 255, 255, 0.08)',
    progressFill: '#2563eb',
    // M5 additions
    draftBg: 'rgba(245, 158, 11, 0.08)',
    draftBorder: '#d97706',
    draftText: '#f59e0b',
    diffAdded: '#22c55e',
    diffAddedBg: 'rgba(34, 197, 94, 0.1)',
    diffRemoved: '#ef4444',
    diffRemovedBg: 'rgba(239, 68, 68, 0.1)',
    diffHeader: '#6b7280',
    coverageMissing: '#ef4444',
    coverageComplete: '#22c55e',
    pillActiveBg: '#2563eb',
    pillActiveText: '#fff',
    pillInactiveBg: 'rgba(255, 255, 255, 0.06)',
    pillInactiveBorder: '#2a2a3e',
    pillInactiveText: '#888',
    subtleBg: 'rgba(255, 255, 255, 0.04)',
  },
  light: {
    pillBg: 'rgba(255, 255, 255, 0.94)',
    pillBorder: '#9fb3df',
    pillText: '#1f2f52',
    panelBg: 'rgba(245, 249, 255, 0.96)',
    panelBorder: '#b8c8e8',
    text: '#1f2f4f',
    muted: '#4f6187',
    inputBg: 'rgba(0, 0, 0, 0.03)',
    inputBorder: '#b8c8e8',
    inputText: '#1f2f4f',
    buttonBg: '#2563eb',
    buttonText: '#fff',
    buttonDisabled: '#93b4e8',
    errorText: '#dc2626',
    successText: '#16a34a',
    badgeCreated: '#2563eb',
    badgeModified: '#d97706',
    close: '#5b6e98',
    progressBg: 'rgba(0, 0, 0, 0.06)',
    progressFill: '#2563eb',
    // M5 additions
    draftBg: 'rgba(245, 158, 11, 0.06)',
    draftBorder: '#d97706',
    draftText: '#b45309',
    diffAdded: '#16a34a',
    diffAddedBg: 'rgba(22, 163, 74, 0.08)',
    diffRemoved: '#dc2626',
    diffRemovedBg: 'rgba(220, 38, 38, 0.08)',
    diffHeader: '#6b7280',
    coverageMissing: '#dc2626',
    coverageComplete: '#16a34a',
    pillActiveBg: '#2563eb',
    pillActiveText: '#fff',
    pillInactiveBg: 'rgba(0, 0, 0, 0.03)',
    pillInactiveBorder: '#b8c8e8',
    pillInactiveText: '#4f6187',
    subtleBg: 'rgba(0, 0, 0, 0.02)',
  },
} as const;

export type BuilderTheme = (typeof BUILDER_THEME)['dark'] | (typeof BUILDER_THEME)['light'];

export const TYPE_COLORS: Record<string, string> = {
  schema: '#8b5cf6',
  model: '#06b6d4',
  service: '#f59e0b',
  route: '#10b981',
  test: '#6366f1',
};

export const STATUS_LABELS: Record<BuilderJobStatus, string> = {
  queued: 'Queued',
  planning: 'Planning...',
  plan_ready: 'Plan ready — awaiting approval',
  reading_context: 'Reading project context...',
  generating: 'Generating code...',
  writing_files: 'Writing files...',
  validating: 'Running validation...',
  creating_pr: 'Creating pull request...',
  committing: 'Committing to main...',
  completed: 'Completed',
  completed_draft: 'Completed (draft)',
  rolled_back: 'Rolled back',
  failed: 'Failed',
  rejected: 'Rejected',
};

export const PROGRESS_ORDER: BuilderJobStatus[] = [
  'queued',
  'planning',
  'plan_ready',
  'reading_context',
  'generating',
  'writing_files',
  'validating',
  'creating_pr',
  'committing',
  'completed',
];

export function getProgressPercent(status: BuilderJobStatus | null): number {
  if (!status) return 0;
  const idx = PROGRESS_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / PROGRESS_ORDER.length) * 100);
}

export const GLOW_KEYFRAMES = `
@keyframes builderShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes builderGlow {
  0%, 100% { box-shadow: 0 0 4px rgba(37, 99, 235, 0.3); }
  50% { box-shadow: 0 0 12px rgba(37, 99, 235, 0.6), 0 0 24px rgba(37, 99, 235, 0.2); }
}
@keyframes builderPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
@keyframes builderIndeterminate {
  0% { left: -40%; }
  100% { left: 100%; }
}
`;
