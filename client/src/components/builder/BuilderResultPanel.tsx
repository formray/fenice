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
            <div
              style={{
                fontSize: '11px',
                color: theme.muted,
                marginTop: '2px',
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              }}
            >
              Branch: {branch}
            </div>
          )}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
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
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
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

      {/* Diffs (dry-run only) */}
      {diffs && diffs.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div
            style={{
              fontSize: '11px',
              color: theme.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
            }}
          >
            Diffs ({diffs.length} files)
          </div>
          <BuilderDiffViewer diffs={diffs} theme={theme} />
        </div>
      )}

      {/* Plan Coverage (dry-run only) */}
      {planCoverage && (
        <div style={{ marginBottom: '8px' }}>
          <div
            style={{
              fontSize: '11px',
              color: theme.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px',
            }}
          >
            Plan Coverage
          </div>
          <div style={{ fontSize: '12px', color: theme.text }}>
            {planCoverage.generated.length}/{planCoverage.planned.length} planned files generated
          </div>
          {planCoverage.missing.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              {planCoverage.missing.map((path) => (
                <div
                  key={path}
                  style={{
                    fontSize: '11px',
                    color: theme.coverageMissing,
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  }}
                >
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
          <div
            style={{
              fontSize: '11px',
              color: theme.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px',
            }}
          >
            Impacted Files ({impactedFiles.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {impactedFiles.map((path) => (
              <div
                key={path}
                style={{
                  fontSize: '11px',
                  color: theme.text,
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                }}
              >
                {path}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
