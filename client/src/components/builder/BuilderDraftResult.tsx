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

export function BuilderDraftResult({
  prUrl,
  prNumber,
  branch,
  validationErrors,
  files,
  theme,
}: Props): React.JSX.Element {
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
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: theme.draftText,
          marginBottom: '8px',
        }}
      >
        Draft PR Created
      </div>
      <div
        style={{
          fontSize: '11px',
          color: theme.muted,
          marginBottom: '8px',
          lineHeight: 1.4,
        }}
      >
        Validation failed after repair attempts. A draft PR has been created for manual fixes.
      </div>
      <a
        href={prUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: '12px',
          color: theme.buttonBg,
          textDecoration: 'underline',
        }}
      >
        View PR #{prNumber} on GitHub
      </a>
      <div
        style={{
          fontSize: '11px',
          color: theme.muted,
          marginTop: '4px',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        }}
      >
        Branch: {branch}
      </div>

      {validationErrors.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => setErrorsExpanded(!errorsExpanded)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              color: theme.draftText,
              padding: 0,
            }}
          >
            {errorsExpanded ? '\u25BE' : '\u25B8'} Validation Errors ({validationErrors.length})
          </button>
          {errorsExpanded && (
            <div
              style={{
                marginTop: '4px',
                padding: '6px 8px',
                borderRadius: '4px',
                backgroundColor: theme.subtleBg,
                fontSize: '11px',
                lineHeight: 1.5,
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                color: theme.errorText,
              }}
            >
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
