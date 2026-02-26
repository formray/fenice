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

export function BuilderTaskSelector({
  selected,
  onSelect,
  disabled,
  theme,
}: Props): React.JSX.Element {
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
