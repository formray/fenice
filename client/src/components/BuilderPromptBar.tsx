import { useEffect, useCallback, useRef } from 'react';
import { useBuilderStore } from '../stores/builder.store';
import { useViewStore } from '../stores/view.store';
import { submitBuilderPrompt, fetchBuilderJob, approveBuilderJob, rejectBuilderJob } from '../services/builder-api';
import type { BuilderJobStatus, BuilderPlanFile } from '../types/builder';

const WS_TOKEN = import.meta.env.VITE_WS_TOKEN as string | undefined;

const BUILDER_THEME = {
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
  },
} as const;

const TYPE_COLORS: Record<string, string> = {
  schema: '#8b5cf6',
  model: '#06b6d4',
  service: '#f59e0b',
  route: '#10b981',
  test: '#6366f1',
};

const STATUS_LABELS: Record<BuilderJobStatus, string> = {
  queued: 'Queued',
  planning: 'Planning...',
  plan_ready: 'Plan ready — awaiting approval',
  reading_context: 'Reading project context...',
  generating: 'Generating code...',
  writing_files: 'Writing files...',
  validating: 'Running validation...',
  creating_pr: 'Creating pull request...',
  completed: 'Completed',
  failed: 'Failed',
  rejected: 'Rejected',
};

const PROGRESS_ORDER: BuilderJobStatus[] = [
  'queued',
  'planning',
  'plan_ready',
  'reading_context',
  'generating',
  'writing_files',
  'validating',
  'creating_pr',
  'completed',
];

function getProgressPercent(status: BuilderJobStatus | null): number {
  if (!status) return 0;
  const idx = PROGRESS_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / PROGRESS_ORDER.length) * 100);
}

export function BuilderPromptBar(): React.JSX.Element {
  const expanded = useBuilderStore((s) => s.expanded);
  const toggleExpanded = useBuilderStore((s) => s.toggleExpanded);
  const prompt = useBuilderStore((s) => s.prompt);
  const setPrompt = useBuilderStore((s) => s.setPrompt);
  const submitting = useBuilderStore((s) => s.submitting);
  const setSubmitting = useBuilderStore((s) => s.setSubmitting);
  const startJob = useBuilderStore((s) => s.startJob);
  const jobId = useBuilderStore((s) => s.jobId);
  const status = useBuilderStore((s) => s.status);
  const statusMessage = useBuilderStore((s) => s.statusMessage);
  const files = useBuilderStore((s) => s.files);
  const logs = useBuilderStore((s) => s.logs);
  const error = useBuilderStore((s) => s.error);
  const dryRun = useBuilderStore((s) => s.dryRun);
  const setDryRun = useBuilderStore((s) => s.setDryRun);
  const setResult = useBuilderStore((s) => s.setResult);
  const setError = useBuilderStore((s) => s.setError);
  const dismiss = useBuilderStore((s) => s.dismiss);
  const plan = useBuilderStore((s) => s.plan);
  const summary = useBuilderStore((s) => s.summary);
  const setPlan = useBuilderStore((s) => s.setPlan);
  const updatePlanFile = useBuilderStore((s) => s.updatePlanFile);
  const removePlanFile = useBuilderStore((s) => s.removePlanFile);

  const visualMode = useViewStore((s) => s.visualMode);
  const theme = BUILDER_THEME[visualMode];
  const logEndRef = useRef<HTMLDivElement>(null);

  const isRunning =
    status !== null && status !== 'completed' && status !== 'failed' && status !== 'rejected' && status !== 'plan_ready';
  const canSubmit = prompt.length >= 10 && prompt.length <= 2000 && !submitting && !isRunning;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !WS_TOKEN) return;
    setSubmitting(true);
    try {
      const { jobId: newJobId } = await submitBuilderPrompt(WS_TOKEN, prompt, dryRun);
      startJob(newJobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    }
  }, [canSubmit, prompt, dryRun, setSubmitting, startJob, setError]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && canSubmit) {
        void handleSubmit();
      }
    },
    [canSubmit, handleSubmit]
  );

  const handleApprove = useCallback(async () => {
    if (!jobId || !WS_TOKEN || !plan || !summary) return;
    try {
      await approveBuilderJob(WS_TOKEN, jobId, { files: plan, summary });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
  }, [jobId, plan, summary, setError]);

  const handleReject = useCallback(async () => {
    if (!jobId || !WS_TOKEN) return;
    try {
      await rejectBuilderJob(WS_TOKEN, jobId);
      dismiss();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    }
  }, [jobId, dismiss, setError]);

  // Fetch full job details when status reaches completed or failed
  useEffect(() => {
    if (!jobId || !WS_TOKEN) return;
    if (status !== 'completed' && status !== 'failed') return;

    let cancelled = false;
    void fetchBuilderJob(WS_TOKEN, jobId)
      .then((job) => {
        if (cancelled) return;
        if (job.status === 'completed' && job.result) {
          setResult(job.result.files);
        } else if (job.status === 'failed' && job.error) {
          setError(job.error.message);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch job details');
      });

    return () => {
      cancelled = true;
    };
  }, [jobId, status, setResult, setError]);

  // Fetch plan details when status reaches plan_ready
  useEffect(() => {
    if (!jobId || !WS_TOKEN || status !== 'plan_ready') return;

    let cancelled = false;
    void fetchBuilderJob(WS_TOKEN, jobId)
      .then((job) => {
        if (cancelled || !job.plan) return;
        setPlan(job.plan.files, job.plan.summary);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch plan');
      });

    return () => { cancelled = true; };
  }, [jobId, status, setPlan, setError]);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const glowKeyframes = `
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

  // Collapsed pill
  if (!expanded) {
    return (
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
        }}
      >
        <button
          type="button"
          onClick={toggleExpanded}
          style={{
            border: `1px solid ${theme.pillBorder}`,
            backgroundColor: theme.pillBg,
            color: theme.pillText,
            borderRadius: '999px',
            padding: '8px 20px',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.3px',
            cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow:
              visualMode === 'dark'
                ? '0 0 16px rgba(37, 99, 235, 0.25)'
                : '0 2px 12px rgba(95, 116, 168, 0.18)',
          }}
          aria-label="Open Builder prompt bar"
        >
          Builder{isRunning ? ` — ${STATUS_LABELS[status]}` : ''}
        </button>
      </div>
    );
  }

  // Expanded panel
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '420px',
        maxWidth: 'calc(100vw - 40px)',
        backgroundColor: theme.panelBg,
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: '12px',
        padding: '16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        color: theme.text,
        zIndex: 100,
        boxShadow:
          visualMode === 'dark'
            ? '0 4px 24px rgba(0, 0, 0, 0.5)'
            : '0 4px 20px rgba(95, 116, 168, 0.2)',
      }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={toggleExpanded}
        style={{
          position: 'absolute',
          top: '8px',
          right: '10px',
          background: 'none',
          border: 'none',
          color: theme.close,
          fontSize: '18px',
          cursor: 'pointer',
          padding: '2px 6px',
          lineHeight: 1,
        }}
        aria-label="Close Builder panel"
      >
        ×
      </button>

      {/* Title */}
      <div
        style={{
          fontSize: '11px',
          color: theme.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '10px',
        }}
      >
        AI Builder
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe an API endpoint to generate..."
          disabled={submitting || isRunning}
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: '6px',
            border: `1px solid ${theme.inputBorder}`,
            backgroundColor: theme.inputBg,
            color: theme.inputText,
            fontSize: '13px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: canSubmit ? theme.buttonBg : theme.buttonDisabled,
            color: theme.buttonText,
            fontSize: '12px',
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: canSubmit ? 1 : 0.6,
            whiteSpace: 'nowrap',
          }}
        >
          Generate
        </button>
      </div>

      {/* Mode toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
        }}
      >
        <button
          type="button"
          onClick={() => setDryRun(!dryRun)}
          disabled={isRunning}
          style={{
            width: '32px',
            height: '18px',
            borderRadius: '9px',
            border: 'none',
            backgroundColor: dryRun
              ? visualMode === 'dark'
                ? 'rgba(255, 255, 255, 0.15)'
                : 'rgba(0, 0, 0, 0.12)'
              : '#2563eb',
            position: 'relative',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            transition: 'background-color 0.2s',
          }}
          aria-label={`Switch to ${dryRun ? 'live' : 'dry run'} mode`}
        >
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              position: 'absolute',
              top: '2px',
              left: dryRun ? '2px' : '16px',
              transition: 'left 0.2s',
            }}
          />
        </button>
        <span style={{ fontSize: '11px', color: theme.text, fontWeight: 500 }}>
          {dryRun ? 'Preview' : 'Live'}
        </span>
        <span style={{ fontSize: '10px', color: theme.muted, lineHeight: 1.3 }}>
          {dryRun
            ? 'Generate code without writing files or creating PRs'
            : 'Write files, create branch, and open a pull request'}
        </span>
      </div>

      {/* Character count hint */}
      {prompt.length > 0 && prompt.length < 10 && (
        <div style={{ fontSize: '11px', color: theme.muted, marginBottom: '8px' }}>
          {10 - prompt.length} more characters needed
        </div>
      )}

      {/* Status + progress bar */}
      {status && (
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                color:
                  status === 'completed'
                    ? theme.successText
                    : status === 'failed' || status === 'rejected'
                      ? theme.errorText
                      : theme.text,
                fontWeight: 500,
              }}
            >
              {statusMessage ?? STATUS_LABELS[status]}
            </span>
            {(status === 'completed' || status === 'failed' || status === 'rejected') && (
              <button
                type="button"
                onClick={dismiss}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.muted,
                  fontSize: '11px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Dismiss
              </button>
            )}
          </div>
          {isRunning && (
            <>
              <style>{glowKeyframes}</style>
              <div style={{
                height: '4px', borderRadius: '2px', backgroundColor: theme.progressBg,
                overflow: 'hidden', position: 'relative' as const,
                animation: 'builderGlow 2s ease-in-out infinite',
              }}>
                {status === 'planning' ? (
                  /* Indeterminate shimmer during planning */
                  <div style={{
                    position: 'absolute' as const, height: '100%', width: '40%',
                    background: `linear-gradient(90deg, transparent, ${theme.progressFill}, transparent)`,
                    animation: 'builderIndeterminate 1.5s ease-in-out infinite',
                  }} />
                ) : (
                  /* Determinate fill with shimmer during generation */
                  <div style={{
                    height: '100%', width: `${getProgressPercent(status)}%`,
                    borderRadius: '2px', transition: 'width 0.6s ease',
                    background: `linear-gradient(90deg, ${theme.progressFill}, #60a5fa, ${theme.progressFill})`,
                    backgroundSize: '200% 100%',
                    animation: 'builderShimmer 2s linear infinite, builderPulse 1.5s ease-in-out infinite',
                  }} />
                )}
              </div>
            </>
          )}
          {status === 'completed' && (
            <div style={{
              height: '4px', borderRadius: '2px', width: '100%',
              backgroundColor: theme.successText,
              boxShadow: `0 0 8px ${theme.successText}40, 0 0 16px ${theme.successText}20`,
            }} />
          )}
        </div>
      )}

      {/* Plan review */}
      {status === 'plan_ready' && plan && (
        <div style={{ marginBottom: '12px' }}>
          {summary && (
            <div style={{ fontSize: '12px', color: theme.text, marginBottom: '10px', lineHeight: 1.4 }}>
              {summary}
            </div>
          )}
          <div style={{
            fontSize: '10px', color: theme.muted, textTransform: 'uppercase' as const,
            letterSpacing: '0.5px', marginBottom: '6px',
          }}>
            Files to Generate ({plan.length})
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: '6px' }}>
            {plan.map((file: BuilderPlanFile, i: number) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px',
                padding: '6px 8px', borderRadius: '6px',
                backgroundColor: visualMode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              }}>
                <span style={{
                  fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
                  color: '#fff', backgroundColor: TYPE_COLORS[file.type] ?? theme.badgeCreated,
                  textTransform: 'uppercase' as const, flexShrink: 0,
                }}>
                  {file.type}
                </span>
                <span style={{
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: '11px',
                  color: theme.text, flexShrink: 0,
                }}>
                  {file.path}
                </span>
                <input
                  type="text"
                  value={file.description}
                  onChange={(e) => updatePlanFile(i, { description: e.target.value })}
                  style={{
                    flex: 1, fontSize: '11px', color: theme.muted, background: 'none',
                    border: 'none', outline: 'none', padding: '0 4px', minWidth: 0,
                  }}
                />
                <button
                  type="button"
                  onClick={() => removePlanFile(i)}
                  style={{
                    background: 'none', border: 'none', color: theme.close,
                    fontSize: '14px', cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0,
                  }}
                  aria-label={`Remove ${file.path}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button type="button" onClick={() => void handleApprove()}
              disabled={!plan || plan.length === 0}
              style={{
                flex: 1, padding: '8px 16px', borderRadius: '6px', border: 'none',
                backgroundColor: plan && plan.length > 0 ? theme.buttonBg : theme.buttonDisabled,
                color: theme.buttonText, fontSize: '12px', fontWeight: 600,
                cursor: plan && plan.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Approve & Generate
            </button>
            <button type="button" onClick={() => void handleReject()}
              style={{
                padding: '8px 16px', borderRadius: '6px',
                border: `1px solid ${theme.errorText}`, backgroundColor: 'transparent',
                color: theme.errorText, fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Activity log */}
      {logs.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div
            style={{
              fontSize: '10px',
              color: theme.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px',
            }}
          >
            Activity
          </div>
          <div
            style={{
              maxHeight: '100px',
              overflowY: 'auto',
              fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace',
              fontSize: '11px',
              lineHeight: 1.6,
              color: theme.muted,
              backgroundColor:
                visualMode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              borderRadius: '4px',
              padding: '6px 8px',
            }}
          >
            {logs.map((log, i) => (
              <div key={i} style={{ opacity: i === logs.length - 1 ? 1 : 0.6 }}>
                {log}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            fontSize: '12px',
            color: theme.errorText,
            marginBottom: '10px',
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '11px',
              color: theme.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
            }}
          >
            Generated Files ({files.length})
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxHeight: '160px',
              overflowY: 'auto',
            }}
          >
            {files.map((file) => (
              <div
                key={file.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  backgroundColor:
                    visualMode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '3px',
                    color: '#fff',
                    backgroundColor:
                      file.action === 'created' ? theme.badgeCreated : theme.badgeModified,
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  {file.action}
                </span>
                <span
                  style={{
                    fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace',
                    fontSize: '11px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: theme.text,
                  }}
                >
                  {file.path}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
