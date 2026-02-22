import { useWorldStore } from '../stores/world.store';
import { METHOD_COLORS, METHOD_LABELS } from '../utils/colors';
import type { HttpMethod } from '../types/world';

const LEGEND_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

export function HUD(): React.JSX.Element {
  const loading = useWorldStore((s) => s.loading);
  const connected = useWorldStore((s) => s.connected);
  const error = useWorldStore((s) => s.error);
  const endpoints = useWorldStore((s) => s.endpoints);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        padding: '16px',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {/* Connection / loading status */}
      {!connected && (
        <div style={{ color: '#ff6b6b', fontSize: '14px', marginBottom: '8px' }}>
          ● Disconnected
        </div>
      )}
      {connected && loading && endpoints.length === 0 && (
        <div style={{ color: '#ffd700', fontSize: '14px', marginBottom: '8px' }}>
          ● Loading world…
        </div>
      )}
      {connected && !loading && endpoints.length > 0 && (
        <div style={{ color: '#50c878', fontSize: '14px', marginBottom: '8px' }}>
          ● Connected ({endpoints.length} endpoints)
        </div>
      )}
      {error && (
        <div style={{ color: '#ff6b6b', fontSize: '12px', marginBottom: '8px' }}>{error}</div>
      )}

      {/* Method color legend */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginTop: '12px',
        }}
      >
        {LEGEND_METHODS.map((method) => (
          <div
            key={method}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              color: '#aaa',
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                backgroundColor: METHOD_COLORS[method],
                flexShrink: 0,
              }}
            />
            {METHOD_LABELS[method]}
          </div>
        ))}
      </div>
    </div>
  );
}
