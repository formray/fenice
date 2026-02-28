import { useEffect, useCallback, useRef } from 'react';
import { useBuilderStore } from '../../stores/builder.store';
import { useViewStore } from '../../stores/view.store';
import {
  submitBuilderPrompt,
  fetchBuilderJob,
  approveBuilderJob,
  rejectBuilderJob,
  rollbackBuilderJob,
} from '../../services/builder-api';
import type { BuilderPlanFile } from '../../types/builder';
import {
  BUILDER_THEME,
  TYPE_COLORS,
  STATUS_LABELS,
  getProgressPercent,
  GLOW_KEYFRAMES,
} from './builder-theme';
import { BuilderTaskSelector } from './BuilderTaskSelector';
import { BuilderDraftResult } from './BuilderDraftResult';
import { BuilderResultPanel } from './BuilderResultPanel';

const WS_TOKEN = import.meta.env.VITE_WS_TOKEN as string | undefined;

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
  const setFullResult = useBuilderStore((s) => s.setFullResult);
  const setError = useBuilderStore((s) => s.setError);
  const diffs = useBuilderStore((s) => s.diffs);
  const planCoverage = useBuilderStore((s) => s.planCoverage);
  const impactedFiles = useBuilderStore((s) => s.impactedFiles);
  const validationErrors = useBuilderStore((s) => s.validationErrors);
  const prUrl = useBuilderStore((s) => s.prUrl);
  const prNumber = useBuilderStore((s) => s.prNumber);
  const branch = useBuilderStore((s) => s.branch);
  const dismiss = useBuilderStore((s) => s.dismiss);
  const plan = useBuilderStore((s) => s.plan);
  const summary = useBuilderStore((s) => s.summary);
  const setPlan = useBuilderStore((s) => s.setPlan);
  const updatePlanFile = useBuilderStore((s) => s.updatePlanFile);
  const removePlanFile = useBuilderStore((s) => s.removePlanFile);
  const taskType = useBuilderStore((s) => s.taskType);
  const setTaskType = useBuilderStore((s) => s.setTaskType);
  const integrationMode = useBuilderStore((s) => s.integrationMode);
  const setIntegrationMode = useBuilderStore((s) => s.setIntegrationMode);
  const commitHash = useBuilderStore((s) => s.commitHash);

  const visualMode = useViewStore((s) => s.visualMode);
  const theme = BUILDER_THEME[visualMode];
  const logEndRef = useRef<HTMLDivElement>(null);

  const isRunning =
    status !== null &&
    status !== 'completed' &&
    status !== 'completed_draft' &&
    status !== 'rolled_back' &&
    status !== 'failed' &&
    status !== 'rejected' &&
    status !== 'plan_ready';
  const canSubmit = prompt.length >= 10 && prompt.length <= 2000 && !submitting && !isRunning;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !WS_TOKEN) return;
    setSubmitting(true);
    try {
      const { jobId: newJobId } = await submitBuilderPrompt(
        WS_TOKEN,
        prompt,
        dryRun,
        taskType,
        integrationMode
      );
      startJob(newJobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    }
  }, [canSubmit, prompt, dryRun, taskType, integrationMode, setSubmitting, startJob, setError]);

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

  const handleRollback = useCallback(async () => {
    if (!jobId || !WS_TOKEN || !commitHash) return;
    try {
      await rollbackBuilderJob(WS_TOKEN, jobId);
      dismiss();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    }
  }, [jobId, commitHash, dismiss, setError]);

  // Fetch full job details when status reaches completed or failed
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

    return () => {
      cancelled = true;
    };
  }, [jobId, status, setFullResult, setError]);

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

    return () => {
      cancelled = true;
    };
  }, [jobId, status, setPlan, setError]);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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

      <BuilderTaskSelector
        selected={taskType}
        onSelect={setTaskType}
        disabled={isRunning}
        theme={theme}
      />

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
            : integrationMode === 'direct'
              ? 'Write files and commit directly to main'
              : 'Write files, create branch, and open a pull request'}
        </span>
      </div>

      {/* Integration mode toggle (only when live) */}
      {!dryRun && (
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
            onClick={() => setIntegrationMode(integrationMode === 'pr' ? 'direct' : 'pr')}
            disabled={isRunning}
            style={{
              width: '32px',
              height: '18px',
              borderRadius: '9px',
              border: 'none',
              backgroundColor:
                integrationMode === 'direct'
                  ? '#f59e0b'
                  : visualMode === 'dark'
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(0, 0, 0, 0.12)',
              position: 'relative',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              transition: 'background-color 0.2s',
            }}
            aria-label={`Switch to ${integrationMode === 'pr' ? 'direct' : 'PR'} mode`}
          >
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: '#fff',
                position: 'absolute',
                top: '2px',
                left: integrationMode === 'pr' ? '2px' : '16px',
                transition: 'left 0.2s',
              }}
            />
          </button>
          <span style={{ fontSize: '11px', color: theme.text, fontWeight: 500 }}>
            {integrationMode === 'direct' ? 'Direct' : 'Pull Request'}
          </span>
          <span style={{ fontSize: '10px', color: theme.muted, lineHeight: 1.3 }}>
            {integrationMode === 'direct'
              ? 'Commit to main — live reload, rollback available'
              : 'Create a PR for review before merging'}
          </span>
        </div>
      )}

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
                    : status === 'completed_draft' || status === 'rolled_back'
                      ? theme.draftText
                      : status === 'failed' || status === 'rejected'
                        ? theme.errorText
                        : theme.text,
                fontWeight: 500,
              }}
            >
              {statusMessage ?? STATUS_LABELS[status]}
            </span>
            {(status === 'completed' ||
              status === 'completed_draft' ||
              status === 'rolled_back' ||
              status === 'failed' ||
              status === 'rejected') && (
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
              <style>{GLOW_KEYFRAMES}</style>
              <div
                style={{
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor: theme.progressBg,
                  overflow: 'hidden',
                  position: 'relative' as const,
                  animation: 'builderGlow 2s ease-in-out infinite',
                }}
              >
                {status === 'planning' ? (
                  /* Indeterminate shimmer during planning */
                  <div
                    style={{
                      position: 'absolute' as const,
                      height: '100%',
                      width: '40%',
                      background: `linear-gradient(90deg, transparent, ${theme.progressFill}, transparent)`,
                      animation: 'builderIndeterminate 1.5s ease-in-out infinite',
                    }}
                  />
                ) : (
                  /* Determinate fill with shimmer during generation */
                  <div
                    style={{
                      height: '100%',
                      width: `${getProgressPercent(status)}%`,
                      borderRadius: '2px',
                      transition: 'width 0.6s ease',
                      background: `linear-gradient(90deg, ${theme.progressFill}, #60a5fa, ${theme.progressFill})`,
                      backgroundSize: '200% 100%',
                      animation:
                        'builderShimmer 2s linear infinite, builderPulse 1.5s ease-in-out infinite',
                    }}
                  />
                )}
              </div>
            </>
          )}
          {status === 'completed' && (
            <div
              style={{
                height: '4px',
                borderRadius: '2px',
                width: '100%',
                backgroundColor: theme.successText,
                boxShadow: `0 0 8px ${theme.successText}40, 0 0 16px ${theme.successText}20`,
              }}
            />
          )}
          {status === 'completed_draft' && (
            <div
              style={{
                height: '4px',
                borderRadius: '2px',
                width: '100%',
                backgroundColor: theme.draftText,
                boxShadow: `0 0 8px ${theme.draftText}40`,
              }}
            />
          )}
        </div>
      )}

      {/* Plan review */}
      {status === 'plan_ready' && plan && (
        <div style={{ marginBottom: '12px' }}>
          {summary && (
            <div
              style={{ fontSize: '12px', color: theme.text, marginBottom: '10px', lineHeight: 1.4 }}
            >
              {summary}
            </div>
          )}
          <div
            style={{
              fontSize: '10px',
              color: theme.muted,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
              marginBottom: '6px',
            }}
          >
            Files to Generate ({plan.length})
          </div>
          <div
            style={{
              maxHeight: '200px',
              overflowY: 'auto' as const,
              display: 'flex',
              flexDirection: 'column' as const,
              gap: '6px',
            }}
          >
            {plan.map((file: BuilderPlanFile, i: number) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  backgroundColor:
                    visualMode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                }}
              >
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '3px',
                    color: '#fff',
                    backgroundColor: TYPE_COLORS[file.type] ?? theme.badgeCreated,
                    textTransform: 'uppercase' as const,
                    flexShrink: 0,
                  }}
                >
                  {file.type}
                </span>
                <span
                  style={{
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                    fontSize: '11px',
                    color: theme.text,
                    flexShrink: 0,
                  }}
                >
                  {file.path}
                </span>
                <input
                  type="text"
                  value={file.description}
                  onChange={(e) => updatePlanFile(i, { description: e.target.value })}
                  style={{
                    flex: 1,
                    fontSize: '11px',
                    color: theme.muted,
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    padding: '0 4px',
                    minWidth: 0,
                  }}
                />
                <button
                  type="button"
                  onClick={() => removePlanFile(i)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.close,
                    fontSize: '14px',
                    cursor: 'pointer',
                    padding: '0 2px',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  aria-label={`Remove ${file.path}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={!plan || plan.length === 0}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: plan && plan.length > 0 ? theme.buttonBg : theme.buttonDisabled,
                color: theme.buttonText,
                fontSize: '12px',
                fontWeight: 600,
                cursor: plan && plan.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Approve & Generate
            </button>
            <button
              type="button"
              onClick={() => void handleReject()}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: `1px solid ${theme.errorText}`,
                backgroundColor: 'transparent',
                color: theme.errorText,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
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

      {/* Draft result (completed_draft) */}
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

      {/* Direct mode result (committed to main) */}
      {status === 'completed' && commitHash && (
        <div style={{ marginBottom: '10px' }}>
          <div
            style={{
              fontSize: '12px',
              color: theme.successText,
              marginBottom: '6px',
              fontWeight: 500,
            }}
          >
            Committed to main
          </div>
          <div
            style={{
              fontSize: '11px',
              color: theme.muted,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              marginBottom: '8px',
            }}
          >
            Commit: {commitHash}
          </div>
          <button
            type="button"
            onClick={() => void handleRollback()}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: `1px solid ${theme.errorText}`,
              backgroundColor: 'transparent',
              color: theme.errorText,
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Rollback
          </button>
        </div>
      )}

      {/* Rolled back status */}
      {status === 'rolled_back' && (
        <div
          style={{
            fontSize: '12px',
            color: theme.draftText,
            marginBottom: '10px',
            lineHeight: 1.4,
          }}
        >
          Changes have been reverted from main.
        </div>
      )}

      {/* Result panel (completed) */}
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
    </div>
  );
}
