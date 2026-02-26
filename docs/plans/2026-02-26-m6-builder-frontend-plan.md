# M6: Builder Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose all M5 Builder v2 backend capabilities in the client UI through modular sub-components extracted from the existing monolithic BuilderPromptBar.

**Architecture:** Split the 722-line `BuilderPromptBar.tsx` into a container + 7 sub-components in a `components/builder/` directory. Update types and store for M5 fields (taskType, diffs, planCoverage, impactedFiles, completed_draft). Add a lightweight diff viewer with colored +/- lines. No new dependencies.

**Tech Stack:** React 19, Zustand 5, TypeScript 5 (strict), Vitest, inline CSS with shared theme object.

---

## Batch 1: Foundation (Types + Store + API)

### Task 1: Add M5 types to builder.ts

**Files:**
- Modify: `client/src/types/builder.ts`
- Test: `client/src/__tests__/builder-types.test.ts` (no test needed — types only, validated by typecheck)

**Step 1: Add TaskType and update BuilderJobStatus**

Add `completed_draft` to the status union and create the `TaskType` type. Add new fields to `BuilderJobResult` and `BuilderPlan`.

In `client/src/types/builder.ts`, make these changes:

1. Add `'completed_draft'` to `BuilderJobStatus` union (after `'completed'`):
```typescript
export type BuilderJobStatus =
  | 'queued'
  | 'planning'
  | 'plan_ready'
  | 'reading_context'
  | 'generating'
  | 'writing_files'
  | 'validating'
  | 'creating_pr'
  | 'completed'
  | 'completed_draft'
  | 'failed'
  | 'rejected';
```

2. Add `TaskType` after `BuilderJobStatus`:
```typescript
export type TaskType =
  | 'new-resource'
  | 'refactor'
  | 'bugfix'
  | 'schema-migration'
  | 'test-gen'
  | 'doc-gen';
```

3. Add `DiffEntry` interface:
```typescript
export interface DiffEntry {
  path: string;
  diff: string;
}

export interface PlanCoverage {
  planned: string[];
  generated: string[];
  missing: string[];
}
```

4. Update `BuilderJobResult` — add new optional fields:
```typescript
export interface BuilderJobResult {
  files: BuilderGeneratedFile[];
  prUrl?: string | undefined;
  prNumber?: number | undefined;
  branch?: string | undefined;
  validationPassed?: boolean | undefined;
  validationErrors?: string[] | undefined;
  tokenUsage?: { inputTokens: number; outputTokens: number } | undefined;
  diffs?: DiffEntry[] | undefined;
  planCoverage?: PlanCoverage | undefined;
  impactedFiles?: string[] | undefined;
}
```

5. Update `BuilderPlan` — add optional `taskType`:
```typescript
export interface BuilderPlan {
  files: BuilderPlanFile[];
  summary: string;
  taskType?: TaskType | undefined;
}
```

**Step 2: Run typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: PASS (types are additive, no breaking changes)

**Step 3: Commit**

```bash
git add client/src/types/builder.ts
git commit -m "feat(client): add M5 types — TaskType, DiffEntry, PlanCoverage, completed_draft"
```

---

### Task 2: Update builder store for M5 fields

**Files:**
- Modify: `client/src/stores/builder.store.ts`
- Modify: `client/src/__tests__/builder.store.test.ts`

**Step 1: Write failing tests for new store fields and actions**

Add these tests to `client/src/__tests__/builder.store.test.ts`:

```typescript
// In the existing describe block, add:

describe('taskType', () => {
  it('should default to new-resource', () => {
    expect(useBuilderStore.getState().taskType).toBe('new-resource');
  });

  it('should update via setTaskType', () => {
    const { setTaskType } = useBuilderStore.getState();
    setTaskType('refactor');
    expect(useBuilderStore.getState().taskType).toBe('refactor');
  });

  it('should reset taskType to default', () => {
    const { setTaskType, reset } = useBuilderStore.getState();
    setTaskType('bugfix');
    reset();
    expect(useBuilderStore.getState().taskType).toBe('new-resource');
  });
});

describe('setResult with M5 fields', () => {
  it('should extract diffs from result', () => {
    const { startJob, setFullResult } = useBuilderStore.getState();
    startJob('job-1');
    setFullResult({
      files: [{ path: 'src/test.ts', content: 'x', action: 'created' }],
      diffs: [{ path: 'src/test.ts', diff: '+hello' }],
    });
    expect(useBuilderStore.getState().diffs).toEqual([{ path: 'src/test.ts', diff: '+hello' }]);
  });

  it('should extract planCoverage from result', () => {
    const { startJob, setFullResult } = useBuilderStore.getState();
    startJob('job-1');
    setFullResult({
      files: [],
      planCoverage: { planned: ['a.ts'], generated: ['a.ts'], missing: [] },
    });
    expect(useBuilderStore.getState().planCoverage).toEqual({
      planned: ['a.ts'], generated: ['a.ts'], missing: [],
    });
  });

  it('should extract impactedFiles from result', () => {
    const { startJob, setFullResult } = useBuilderStore.getState();
    startJob('job-1');
    setFullResult({
      files: [],
      impactedFiles: ['src/other.ts'],
    });
    expect(useBuilderStore.getState().impactedFiles).toEqual(['src/other.ts']);
  });

  it('should extract prUrl and prNumber from result', () => {
    const { startJob, setFullResult } = useBuilderStore.getState();
    startJob('job-1');
    setFullResult({
      files: [],
      prUrl: 'https://github.com/formray/fenice/pull/42',
      prNumber: 42,
      branch: 'builder/job-1-test',
    });
    const state = useBuilderStore.getState();
    expect(state.prUrl).toBe('https://github.com/formray/fenice/pull/42');
    expect(state.prNumber).toBe(42);
    expect(state.branch).toBe('builder/job-1-test');
  });

  it('should extract validationErrors for completed_draft', () => {
    const { startJob, setFullResult } = useBuilderStore.getState();
    startJob('job-1');
    setFullResult({
      files: [],
      validationPassed: false,
      validationErrors: ['typecheck: TS2345', 'lint: 3 errors'],
    });
    const state = useBuilderStore.getState();
    expect(state.validationErrors).toEqual(['typecheck: TS2345', 'lint: 3 errors']);
  });

  it('should set status to completed_draft when validationPassed is false', () => {
    const { startJob, setFullResult } = useBuilderStore.getState();
    startJob('job-1');
    setFullResult({
      files: [{ path: 'a.ts', content: 'x', action: 'created' }],
      validationPassed: false,
      validationErrors: ['error'],
    });
    expect(useBuilderStore.getState().status).toBe('completed_draft');
  });

  it('should clear M5 fields on dismiss', () => {
    const { startJob, setFullResult, dismiss } = useBuilderStore.getState();
    startJob('job-1');
    setFullResult({
      files: [],
      diffs: [{ path: 'a.ts', diff: '+x' }],
      planCoverage: { planned: ['a.ts'], generated: [], missing: ['a.ts'] },
      impactedFiles: ['b.ts'],
      prUrl: 'url',
      prNumber: 1,
      branch: 'br',
      validationErrors: ['err'],
    });
    dismiss();
    const s = useBuilderStore.getState();
    expect(s.diffs).toBeNull();
    expect(s.planCoverage).toBeNull();
    expect(s.impactedFiles).toBeNull();
    expect(s.prUrl).toBeNull();
    expect(s.prNumber).toBeNull();
    expect(s.branch).toBeNull();
    expect(s.validationErrors).toBeNull();
  });
});

describe('applyProgress with completed_draft', () => {
  it('should update status to completed_draft', () => {
    const { startJob, applyProgress } = useBuilderStore.getState();
    startJob('job-1');
    applyProgress({ jobId: 'job-1', status: 'completed_draft', message: 'Draft PR created' });
    expect(useBuilderStore.getState().status).toBe('completed_draft');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run __tests__/builder.store.test.ts`
Expected: FAIL (setTaskType, setFullResult, and new state fields don't exist yet)

**Step 3: Update the store implementation**

In `client/src/stores/builder.store.ts`:

1. Add imports for new types:
```typescript
import type {
  BuilderJobStatus,
  BuilderGeneratedFile,
  BuilderProgressPayload,
  BuilderPlanFile,
  TaskType,
  DiffEntry,
  PlanCoverage,
  BuilderJobResult,
} from '../types/builder';
```

2. Add new fields to `BuilderState` interface (after `summary: string | null`):
```typescript
  taskType: TaskType;
  diffs: DiffEntry[] | null;
  planCoverage: PlanCoverage | null;
  impactedFiles: string[] | null;
  validationErrors: string[] | null;
  prUrl: string | null;
  prNumber: number | null;
  branch: string | null;

  setTaskType: (taskType: TaskType) => void;
  setFullResult: (result: BuilderJobResult) => void;
```

3. Add new fields to `initialState`:
```typescript
  taskType: 'new-resource' as TaskType,
  diffs: null as DiffEntry[] | null,
  planCoverage: null as PlanCoverage | null,
  impactedFiles: null as string[] | null,
  validationErrors: null as string[] | null,
  prUrl: null as string | null,
  prNumber: null as number | null,
  branch: null as string | null,
```

4. Add new actions in the `create` call:
```typescript
  setTaskType: (taskType) => set({ taskType }),

  setFullResult: (result) =>
    set({
      files: result.files,
      status: result.validationPassed === false ? 'completed_draft' : 'completed',
      submitting: false,
      diffs: result.diffs ?? null,
      planCoverage: result.planCoverage ?? null,
      impactedFiles: result.impactedFiles ?? null,
      validationErrors: result.validationErrors ?? null,
      prUrl: result.prUrl ?? null,
      prNumber: result.prNumber ?? null,
      branch: result.branch ?? null,
    }),
```

5. Update `dismiss` to clear M5 fields:
```typescript
  dismiss: () =>
    set({
      jobId: null,
      status: null,
      statusMessage: null,
      files: [],
      logs: [],
      error: null,
      plan: null,
      summary: null,
      diffs: null,
      planCoverage: null,
      impactedFiles: null,
      validationErrors: null,
      prUrl: null,
      prNumber: null,
      branch: null,
    }),
```

Note: Keep the existing `setResult` action unchanged for backward compatibility — the new `setFullResult` is the M5-aware version.

**Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run __tests__/builder.store.test.ts`
Expected: PASS

**Step 5: Run full client tests**

Run: `cd client && npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add client/src/stores/builder.store.ts client/src/__tests__/builder.store.test.ts
git commit -m "feat(client): add M5 fields to builder store — taskType, diffs, coverage, draft"
```

---

### Task 3: Update builder-api for taskType

**Files:**
- Modify: `client/src/services/builder-api.ts`

**Step 1: Add taskType parameter to submitBuilderPrompt**

In `client/src/services/builder-api.ts`, update the function signature and body:

```typescript
import type { BuilderJob, BuilderPlanFile, TaskType } from '../types/builder';

// ...

export async function submitBuilderPrompt(
  token: string,
  prompt: string,
  dryRun: boolean,
  taskType?: TaskType
): Promise<SubmitResponse> {
  const options: Record<string, unknown> = { dryRun };
  if (taskType) {
    options['taskType'] = taskType;
  }

  const res = await fetch('/api/v1/builder/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, options }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Builder request failed (${res.status})`);
  }

  return (await res.json()) as SubmitResponse;
}
```

**Step 2: Run typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add client/src/services/builder-api.ts
git commit -m "feat(client): pass taskType in builder API submit call"
```

---

## Batch 2: Extract Theme + Container

### Task 4: Extract builder-theme.ts

**Files:**
- Create: `client/src/components/builder/builder-theme.ts`

**Step 1: Create the shared theme file**

Create `client/src/components/builder/builder-theme.ts` with the theme object extracted from `BuilderPromptBar.tsx` lines 9-54, plus M5 color additions:

```typescript
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

export type BuilderTheme = (typeof BUILDER_THEME)['dark'];

export const TYPE_COLORS: Record<string, string> = {
  schema: '#8b5cf6',
  model: '#06b6d4',
  service: '#f59e0b',
  route: '#10b981',
  test: '#6366f1',
};

export const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  planning: 'Planning...',
  plan_ready: 'Plan ready — awaiting approval',
  reading_context: 'Reading project context...',
  generating: 'Generating code...',
  writing_files: 'Writing files...',
  validating: 'Running validation...',
  creating_pr: 'Creating pull request...',
  completed: 'Completed',
  completed_draft: 'Draft PR created',
  failed: 'Failed',
  rejected: 'Rejected',
};

export const PROGRESS_ORDER = [
  'queued',
  'planning',
  'plan_ready',
  'reading_context',
  'generating',
  'writing_files',
  'validating',
  'creating_pr',
  'completed',
] as const;

export function getProgressPercent(status: string | null): number {
  if (!status) return 0;
  const idx = PROGRESS_ORDER.indexOf(status as (typeof PROGRESS_ORDER)[number]);
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
```

**Step 2: Run typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add client/src/components/builder/builder-theme.ts
git commit -m "feat(client): extract builder-theme with M5 color tokens"
```

---

### Task 5: Create container BuilderPromptBar in builder/ directory

**Files:**
- Create: `client/src/components/builder/BuilderPromptBar.tsx`
- Modify: `client/src/App.tsx` (update import path)
- Delete: `client/src/components/BuilderPromptBar.tsx` (old monolith — but only after the new one works)

This task creates the new container that initially just re-exports the old monolith's exact behavior by importing the theme from `builder-theme.ts`. The full extraction into sub-components happens in subsequent tasks.

**Step 1: Copy the old monolith to the new location**

Copy `client/src/components/BuilderPromptBar.tsx` to `client/src/components/builder/BuilderPromptBar.tsx`.

Then update it to import from the shared theme instead of defining it inline:

Replace the inline `BUILDER_THEME`, `TYPE_COLORS`, `STATUS_LABELS`, `PROGRESS_ORDER`, `getProgressPercent`, and `glowKeyframes` definitions with imports:

```typescript
import {
  BUILDER_THEME,
  TYPE_COLORS,
  STATUS_LABELS,
  getProgressPercent,
  GLOW_KEYFRAMES,
} from './builder-theme';
```

Remove the corresponding inline definitions (lines 9-95 and lines 217-234 of the old file). Replace `glowKeyframes` references with `GLOW_KEYFRAMES`.

**Step 2: Update App.tsx import**

In `client/src/App.tsx`, change:
```typescript
import { BuilderPromptBar } from './components/BuilderPromptBar';
```
to:
```typescript
import { BuilderPromptBar } from './components/builder/BuilderPromptBar';
```

**Step 3: Delete old monolith**

Delete `client/src/components/BuilderPromptBar.tsx`.

**Step 4: Run tests and typecheck**

Run: `cd client && npx tsc --noEmit && npx vitest run`
Expected: All pass (behavior unchanged, only file location moved)

**Step 5: Commit**

```bash
git add client/src/components/builder/BuilderPromptBar.tsx client/src/App.tsx
git rm client/src/components/BuilderPromptBar.tsx
git commit -m "refactor(client): move BuilderPromptBar to builder/ directory with shared theme"
```

---

## Batch 3: Extract Sub-Components

### Task 6: Extract BuilderTaskSelector

**Files:**
- Create: `client/src/components/builder/BuilderTaskSelector.tsx`
- Create: `client/src/__tests__/BuilderTaskSelector.test.tsx`
- Modify: `client/src/components/builder/BuilderPromptBar.tsx` (integrate)

**Step 1: Write tests**

Create `client/src/__tests__/BuilderTaskSelector.test.tsx`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run __tests__/BuilderTaskSelector.test.tsx`
Expected: FAIL (component doesn't exist)

**Step 3: Implement the component**

Create `client/src/components/builder/BuilderTaskSelector.tsx`:

```typescript
import type { TaskType } from '../../types/builder';
import type { BuilderTheme } from './builder-theme';

interface Props {
  selected: TaskType;
  onSelect: (type: TaskType) => void;
  disabled: boolean;
  theme: BuilderTheme;
}

const TASK_TYPE_PILLS: Array<{ value: TaskType; label: string }> = [
  { value: 'new-resource', label: 'New Resource' },
  { value: 'refactor', label: 'Refactor' },
  { value: 'bugfix', label: 'Bugfix' },
  { value: 'schema-migration', label: 'Migration' },
  { value: 'test-gen', label: 'Tests' },
  { value: 'doc-gen', label: 'Docs' },
];

export function BuilderTaskSelector({ selected, onSelect, disabled, theme }: Props): React.JSX.Element {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
      {TASK_TYPE_PILLS.map(({ value, label }) => {
        const isActive = selected === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => !disabled && onSelect(value)}
            disabled={disabled}
            style={{
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: isActive ? 600 : 400,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              border: isActive ? 'none' : `1px solid ${theme.pillInactiveBorder}`,
              backgroundColor: isActive ? theme.pillActiveBg : theme.pillInactiveBg,
              color: isActive ? theme.pillActiveText : theme.pillInactiveText,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run __tests__/BuilderTaskSelector.test.tsx`
Expected: PASS

**Step 5: Wire into BuilderPromptBar**

In `client/src/components/builder/BuilderPromptBar.tsx`:

1. Add import:
```typescript
import { BuilderTaskSelector } from './BuilderTaskSelector';
```

2. Add store hooks (near other store selectors):
```typescript
const taskType = useBuilderStore((s) => s.taskType);
const setTaskType = useBuilderStore((s) => s.setTaskType);
```

3. Insert the component in the expanded panel JSX, right after the "AI Builder" title div and before the input row:
```tsx
<BuilderTaskSelector
  selected={taskType}
  onSelect={setTaskType}
  disabled={isRunning}
  theme={theme}
/>
```

4. Update `handleSubmit` to pass taskType:
```typescript
const { jobId: newJobId } = await submitBuilderPrompt(WS_TOKEN, prompt, dryRun, taskType);
```

**Step 6: Run all client tests**

Run: `cd client && npx vitest run`
Expected: All pass

**Step 7: Commit**

```bash
git add client/src/components/builder/BuilderTaskSelector.tsx client/src/__tests__/BuilderTaskSelector.test.tsx client/src/components/builder/BuilderPromptBar.tsx
git commit -m "feat(client): add BuilderTaskSelector pill component"
```

---

### Task 7: Extract BuilderDiffViewer

**Files:**
- Create: `client/src/components/builder/BuilderDiffViewer.tsx`
- Create: `client/src/__tests__/BuilderDiffViewer.test.tsx`

**Step 1: Write tests**

Create `client/src/__tests__/BuilderDiffViewer.test.tsx`:

```typescript
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
    // Diff content should not be visible
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
```

**Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run __tests__/BuilderDiffViewer.test.tsx`
Expected: FAIL

**Step 3: Implement the component**

Create `client/src/components/builder/BuilderDiffViewer.tsx`:

```typescript
import { useState } from 'react';
import type { DiffEntry } from '../../types/builder';
import type { BuilderTheme } from './builder-theme';

interface Props {
  diffs: DiffEntry[];
  theme: BuilderTheme;
}

function getLineStyle(line: string, theme: BuilderTheme): React.CSSProperties {
  if (line.startsWith('+')) {
    return { color: theme.diffAdded, backgroundColor: theme.diffAddedBg };
  }
  if (line.startsWith('-')) {
    return { color: theme.diffRemoved, backgroundColor: theme.diffRemovedBg };
  }
  if (line.startsWith('@@')) {
    return { color: theme.diffHeader };
  }
  return {};
}

export function BuilderDiffViewer({ diffs, theme }: Props): React.JSX.Element | null {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (diffs.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {diffs.map((entry, i) => {
        const isExpanded = expandedIndex === i;
        return (
          <div key={entry.path}>
            <button
              type="button"
              onClick={() => setExpandedIndex(isExpanded ? null : i)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: '4px 6px',
                cursor: 'pointer',
                fontSize: '11px',
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                color: theme.text,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '10px', color: theme.muted }}>
                {isExpanded ? '▾' : '▸'}
              </span>
              <span>{entry.path}</span>
            </button>
            {isExpanded && (
              <pre
                style={{
                  margin: 0,
                  padding: '6px 8px',
                  fontSize: '11px',
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  lineHeight: 1.5,
                  overflowX: 'auto',
                  borderRadius: '4px',
                  backgroundColor: theme.subtleBg,
                }}
              >
                {entry.diff.split('\n').map((line, j) => (
                  <div key={j} style={getLineStyle(line, theme)}>
                    {line || '\u00A0'}
                  </div>
                ))}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run __tests__/BuilderDiffViewer.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/components/builder/BuilderDiffViewer.tsx client/src/__tests__/BuilderDiffViewer.test.tsx
git commit -m "feat(client): add BuilderDiffViewer component with colored +/- lines"
```

---

### Task 8: Extract BuilderDraftResult

**Files:**
- Create: `client/src/components/builder/BuilderDraftResult.tsx`
- Create: `client/src/__tests__/BuilderDraftResult.test.tsx`

**Step 1: Write tests**

Create `client/src/__tests__/BuilderDraftResult.test.tsx`:

```typescript
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
```

**Step 2: Implement the component**

Create `client/src/components/builder/BuilderDraftResult.tsx`:

```typescript
import { useState } from 'react';
import type { BuilderGeneratedFile } from '../../types/builder';
import type { BuilderTheme } from './builder-theme';

interface Props {
  prUrl: string;
  prNumber: number;
  branch: string;
  validationErrors: string[];
  files: BuilderGeneratedFile[];
  theme: BuilderTheme;
}

export function BuilderDraftResult({ prUrl, prNumber, branch, validationErrors, files, theme }: Props): React.JSX.Element {
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  return (
    <div
      style={{
        border: `1px solid ${theme.draftBorder}`,
        backgroundColor: theme.draftBg,
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '10px',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: theme.draftText, marginBottom: '8px' }}>
        Draft PR Created
      </div>
      <div style={{ fontSize: '11px', color: theme.muted, marginBottom: '8px', lineHeight: 1.4 }}>
        Validation failed after repair attempts. A draft PR has been created for manual fixes.
      </div>
      <a
        href={prUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: '12px', color: theme.buttonBg, textDecoration: 'underline' }}
      >
        View PR #{prNumber} on GitHub
      </a>
      <div style={{ fontSize: '11px', color: theme.muted, marginTop: '4px', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
        Branch: {branch}
      </div>

      {validationErrors.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => setErrorsExpanded(!errorsExpanded)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '11px', color: theme.draftText, padding: 0,
            }}
          >
            {errorsExpanded ? '▾' : '▸'} Validation Errors ({validationErrors.length})
          </button>
          {errorsExpanded && (
            <div style={{
              marginTop: '4px', padding: '6px 8px', borderRadius: '4px',
              backgroundColor: theme.subtleBg, fontSize: '11px', lineHeight: 1.5,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', color: theme.errorText,
            }}>
              {validationErrors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {files.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: theme.muted }}>
          Files ({files.length})
        </div>
      )}
    </div>
  );
}
```

**Step 3: Run tests**

Run: `cd client && npx vitest run __tests__/BuilderDraftResult.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add client/src/components/builder/BuilderDraftResult.tsx client/src/__tests__/BuilderDraftResult.test.tsx
git commit -m "feat(client): add BuilderDraftResult amber component for draft PRs"
```

---

### Task 9: Extract BuilderResultPanel

**Files:**
- Create: `client/src/components/builder/BuilderResultPanel.tsx`
- Create: `client/src/__tests__/BuilderResultPanel.test.tsx`

**Step 1: Write tests**

Create `client/src/__tests__/BuilderResultPanel.test.tsx`:

```typescript
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
    expect(screen.getByText('b.ts')).toBeDefined();
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
```

**Step 2: Implement the component**

Create `client/src/components/builder/BuilderResultPanel.tsx`. This component includes the file list (extracted from the old monolith lines 650-718), plus new dry-run sections that delegate to `BuilderDiffViewer`:

```typescript
import type { BuilderGeneratedFile, DiffEntry, PlanCoverage } from '../../types/builder';
import type { BuilderTheme } from './builder-theme';
import { BuilderDiffViewer } from './BuilderDiffViewer';

interface Props {
  files: BuilderGeneratedFile[];
  prUrl: string | null;
  prNumber: number | null;
  branch: string | null;
  diffs: DiffEntry[] | null;
  planCoverage: PlanCoverage | null;
  impactedFiles: string[] | null;
  theme: BuilderTheme;
  visualMode: 'dark' | 'light';
}

export function BuilderResultPanel({
  files,
  prUrl,
  prNumber,
  branch,
  diffs,
  planCoverage,
  impactedFiles,
  theme,
  visualMode,
}: Props): React.JSX.Element {
  return (
    <div>
      {/* PR link */}
      {prUrl && prNumber && (
        <div style={{ marginBottom: '8px' }}>
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '12px', color: theme.buttonBg, textDecoration: 'underline' }}
          >
            View PR #{prNumber} on GitHub
          </a>
          {branch && (
            <div style={{ fontSize: '11px', color: theme.muted, marginTop: '2px', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
              Branch: {branch}
            </div>
          )}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{
            fontSize: '11px', color: theme.muted, textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: '6px',
          }}>
            Generated Files ({files.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
            {files.map((file) => (
              <div key={file.path} style={{
                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px',
                padding: '4px 6px', borderRadius: '4px',
                backgroundColor: visualMode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              }}>
                <span style={{
                  display: 'inline-block', fontSize: '9px', fontWeight: 700,
                  padding: '1px 5px', borderRadius: '3px', color: '#fff',
                  backgroundColor: file.action === 'created' ? theme.badgeCreated : theme.badgeModified,
                  textTransform: 'uppercase', flexShrink: 0,
                }}>
                  {file.action}
                </span>
                <span style={{
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', color: theme.text,
                }}>
                  {file.path}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diffs (dry-run only) */}
      {diffs && diffs.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{
            fontSize: '11px', color: theme.muted, textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: '6px',
          }}>
            Diffs ({diffs.length} files)
          </div>
          <BuilderDiffViewer diffs={diffs} theme={theme} />
        </div>
      )}

      {/* Plan Coverage (dry-run only) */}
      {planCoverage && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{
            fontSize: '11px', color: theme.muted, textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: '4px',
          }}>
            Plan Coverage
          </div>
          <div style={{ fontSize: '12px', color: theme.text }}>
            {planCoverage.generated.length}/{planCoverage.planned.length} planned files generated
          </div>
          {planCoverage.missing.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              {planCoverage.missing.map((path) => (
                <div key={path} style={{
                  fontSize: '11px', color: theme.coverageMissing,
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                }}>
                  Missing: {path}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Impacted Files (dry-run only) */}
      {impactedFiles && impactedFiles.length > 0 && (
        <div>
          <div style={{
            fontSize: '11px', color: theme.muted, textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: '4px',
          }}>
            Impacted Files ({impactedFiles.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {impactedFiles.map((path) => (
              <div key={path} style={{
                fontSize: '11px', color: theme.text,
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              }}>
                {path}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Run tests**

Run: `cd client && npx vitest run __tests__/BuilderResultPanel.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add client/src/components/builder/BuilderResultPanel.tsx client/src/__tests__/BuilderResultPanel.test.tsx
git commit -m "feat(client): add BuilderResultPanel with diffs, coverage, and impacted files"
```

---

## Batch 4: Wire Everything Into Container

### Task 10: Wire sub-components into BuilderPromptBar container

**Files:**
- Modify: `client/src/components/builder/BuilderPromptBar.tsx`

This is the key integration task. Replace inline sections of the monolith with the new sub-components and wire the M5 store fields.

**Step 1: Update imports and store hooks**

Add imports at top of `BuilderPromptBar.tsx`:
```typescript
import { BuilderDraftResult } from './BuilderDraftResult';
import { BuilderResultPanel } from './BuilderResultPanel';
```

Add new store selectors (near existing ones):
```typescript
const diffs = useBuilderStore((s) => s.diffs);
const planCoverage = useBuilderStore((s) => s.planCoverage);
const impactedFiles = useBuilderStore((s) => s.impactedFiles);
const validationErrors = useBuilderStore((s) => s.validationErrors);
const prUrl = useBuilderStore((s) => s.prUrl);
const prNumber = useBuilderStore((s) => s.prNumber);
const branch = useBuilderStore((s) => s.branch);
const setFullResult = useBuilderStore((s) => s.setFullResult);
```

**Step 2: Update isRunning to include completed_draft**

```typescript
const isRunning =
  status !== null &&
  status !== 'completed' &&
  status !== 'completed_draft' &&
  status !== 'failed' &&
  status !== 'rejected' &&
  status !== 'plan_ready';
```

**Step 3: Update the completed/failed fetch effect**

Replace the existing `useEffect` for fetching job details (lines ~170-192) to also handle `completed_draft` and use `setFullResult`:

```typescript
useEffect(() => {
  if (!jobId || !WS_TOKEN) return;
  if (status !== 'completed' && status !== 'completed_draft' && status !== 'failed') return;

  let cancelled = false;
  void fetchBuilderJob(WS_TOKEN, jobId)
    .then((job) => {
      if (cancelled) return;
      if ((job.status === 'completed' || job.status === 'completed_draft') && job.result) {
        setFullResult(job.result);
      } else if (job.status === 'failed' && job.error) {
        setError(job.error.message);
      }
    })
    .catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch job details');
    });

  return () => { cancelled = true; };
}, [jobId, status, setFullResult, setError]);
```

**Step 4: Update the status color to include completed_draft (amber)**

In the status text rendering, update the color logic:
```typescript
color:
  status === 'completed'
    ? theme.successText
    : status === 'completed_draft'
      ? theme.draftText
      : status === 'failed' || status === 'rejected'
        ? theme.errorText
        : theme.text,
```

**Step 5: Update dismiss button to show for completed_draft**

```typescript
{(status === 'completed' || status === 'completed_draft' || status === 'failed' || status === 'rejected') && (
  <button ...>Dismiss</button>
)}
```

**Step 6: Add completed_draft bar (amber)**

After the `status === 'completed'` green bar section, add:
```tsx
{status === 'completed_draft' && (
  <div style={{
    height: '4px', borderRadius: '2px', width: '100%',
    backgroundColor: theme.draftText,
    boxShadow: `0 0 8px ${theme.draftText}40`,
  }} />
)}
```

**Step 7: Add BuilderDraftResult after error section**

After the error message div and before the file list, insert:
```tsx
{status === 'completed_draft' && prUrl && prNumber && branch && (
  <BuilderDraftResult
    prUrl={prUrl}
    prNumber={prNumber}
    branch={branch}
    validationErrors={validationErrors ?? []}
    files={files}
    theme={theme}
  />
)}
```

**Step 8: Replace the inline file list with BuilderResultPanel**

Replace the existing file list section (the last `{files.length > 0 && (...)}` block) with:
```tsx
{status === 'completed' && files.length > 0 && (
  <BuilderResultPanel
    files={files}
    prUrl={prUrl}
    prNumber={prNumber}
    branch={branch}
    diffs={diffs}
    planCoverage={planCoverage}
    impactedFiles={impactedFiles}
    theme={theme}
    visualMode={visualMode}
  />
)}
```

**Step 9: Run tests and typecheck**

Run: `cd client && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 10: Commit**

```bash
git add client/src/components/builder/BuilderPromptBar.tsx
git commit -m "feat(client): wire M5 sub-components into BuilderPromptBar container"
```

---

## Batch 5: Final Validation

### Task 11: Full integration test and cleanup

**Files:**
- Modify: `client/src/components/builder/BuilderPromptBar.tsx` (if any cleanup needed)

**Step 1: Run full client test suite**

Run: `cd client && npx vitest run`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: PASS

**Step 3: Run lint**

Run: `cd client && npx eslint src/`
Expected: No errors (or only pre-existing ones)

**Step 4: Visual smoke test**

Start the dev server and verify:
1. Builder pill opens to expanded panel
2. Task type pills render, clicking changes selection
3. Prompt input works, Generate button enables at 10+ chars
4. Preview/Live toggle works
5. If a completed job with diffs exists, the diff viewer renders with colored lines
6. The layout hasn't shifted or broken

**Step 5: Commit any final fixes**

```bash
git commit -m "chore(client): M6 builder frontend cleanup and validation"
```

---

## Summary

| Batch | Tasks | What it delivers |
|---|---|---|
| 1: Foundation | 1-3 | Types, store, API updated for M5 fields |
| 2: Extract Theme | 4-5 | Shared theme + container moved to builder/ directory |
| 3: Sub-Components | 6-9 | TaskSelector, DiffViewer, DraftResult, ResultPanel |
| 4: Integration | 10 | Wire all sub-components into container |
| 5: Validation | 11 | Final test pass and cleanup |

**Total: 11 tasks across 5 batches.**
