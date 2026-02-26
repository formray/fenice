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
                {isExpanded ? '\u25BE' : '\u25B8'}
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
