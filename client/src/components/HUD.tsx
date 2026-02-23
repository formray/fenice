import { useWorldStore } from '../stores/world.store';
import { useViewStore } from '../stores/view.store';
import { METHOD_COLORS, METHOD_LABELS, LINK_STATE_COLORS } from '../utils/colors';
import type { HttpMethod } from '../types/world';
import type { LinkState } from '../types/semantic';
import type { RouteLayerMode } from '../stores/view.store';

const LEGEND_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

const LEGEND_LINK_STATES: { state: LinkState; label: string }[] = [
  { state: 'ok', label: 'OK' },
  { state: 'degraded', label: 'Degraded' },
  { state: 'blocked', label: 'Blocked' },
  { state: 'unknown', label: 'Unknown' },
];

const ROUTE_LAYER_OPTIONS: Array<{ mode: RouteLayerMode; label: string }> = [
  { mode: 'city', label: 'City Corridors' },
  { mode: 'debug', label: 'Endpoint Debug' },
  { mode: 'both', label: 'Both' },
];

const HUD_THEME = {
  dark: {
    text: '#a8b4d6',
    muted: '#6f7ca3',
    divider: '#2a3553',
    panelBg: 'rgba(8, 12, 28, 0.38)',
    panelBorder: 'rgba(61, 83, 130, 0.45)',
    buttonBg: 'rgba(12, 20, 42, 0.78)',
    buttonBorder: '#2f4670',
    buttonText: '#d8e6ff',
  },
  light: {
    text: '#2f3f63',
    muted: '#55648c',
    divider: '#b9c7e7',
    panelBg: 'rgba(247, 250, 255, 0.82)',
    panelBorder: 'rgba(124, 147, 197, 0.55)',
    buttonBg: 'rgba(255, 255, 255, 0.94)',
    buttonBorder: '#9fb3df',
    buttonText: '#1f2f52',
  },
} as const;

export function HUD(): React.JSX.Element {
  const loading = useWorldStore((s) => s.loading);
  const connected = useWorldStore((s) => s.connected);
  const error = useWorldStore((s) => s.error);
  const endpoints = useWorldStore((s) => s.endpoints);
  const visualMode = useViewStore((s) => s.visualMode);
  const toggleVisualMode = useViewStore((s) => s.toggleVisualMode);
  const routeLayerMode = useViewStore((s) => s.routeLayerMode);
  const setRouteLayerMode = useViewStore((s) => s.setRouteLayerMode);
  const theme = HUD_THEME[visualMode];

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
      <div style={{ marginBottom: '12px', pointerEvents: 'auto' }}>
        <button
          type="button"
          onClick={toggleVisualMode}
          style={{
            border: `1px solid ${theme.buttonBorder}`,
            backgroundColor: theme.buttonBg,
            color: theme.buttonText,
            borderRadius: '999px',
            padding: '6px 10px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.3px',
            cursor: 'pointer',
            boxShadow:
              visualMode === 'dark'
                ? '0 0 12px rgba(0, 165, 255, 0.22)'
                : '0 1px 10px rgba(95, 116, 168, 0.15)',
          }}
          aria-label="Toggle visual mode"
        >
          Theme: {visualMode === 'dark' ? 'Dark' : 'Light'}
        </button>
      </div>

      <div style={{ marginBottom: '10px', pointerEvents: 'auto' }}>
        <div
          style={{
            fontSize: '10px',
            color: theme.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '6px',
          }}
        >
          Route Layer
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxWidth: '230px' }}>
          {ROUTE_LAYER_OPTIONS.map((option) => {
            const active = option.mode === routeLayerMode;
            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => setRouteLayerMode(option.mode)}
                style={{
                  border: `1px solid ${active ? '#4ea2ff' : theme.buttonBorder}`,
                  backgroundColor: active ? 'rgba(34, 115, 220, 0.22)' : theme.buttonBg,
                  color: theme.buttonText,
                  borderRadius: '999px',
                  padding: '5px 9px',
                  fontSize: '10px',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          backgroundColor: theme.panelBg,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: '10px',
          padding: '10px 12px',
          maxWidth: '220px',
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
                color: theme.text,
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

        {/* Link state legend */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            marginTop: '16px',
            borderTop: `1px solid ${theme.divider}`,
            paddingTop: '12px',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              color: theme.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px',
            }}
          >
            Link State
          </div>
          {LEGEND_LINK_STATES.map(({ state, label }) => (
            <div
              key={state}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                color: theme.text,
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: LINK_STATE_COLORS[state].hex,
                  opacity: LINK_STATE_COLORS[state].opacity,
                  flexShrink: 0,
                }}
              />
              {label}
            </div>
          ))}
        </div>

        {/* Building visual guide */}
        <div
          style={{
            marginTop: '14px',
            borderTop: `1px solid ${theme.divider}`,
            paddingTop: '10px',
            fontSize: '10px',
            color: theme.muted,
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px',
            }}
          >
            Building Guide
          </div>
          <div>Body color = HTTP method</div>
          <div>Base ring = endpoint link state</div>
          <div>Height = parameter complexity</div>
        </div>

        {/* Corridors legend */}
        <div
          style={{
            marginTop: '14px',
            borderTop: `1px solid ${theme.divider}`,
            paddingTop: '10px',
            fontSize: '10px',
            color: theme.muted,
            lineHeight: 1.5,
          }}
        >
          <div style={{ textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Corridors
          </div>
          <div>Radial roads from auth gate to protected services</div>
          <div>Road color = worst link state of service endpoints</div>
          <div>Flow markers = data flowing through the gate</div>
          <div>Gate closed = all corridors blocked (red)</div>
        </div>

        {/* Routing hint legend */}
        <div
          style={{
            marginTop: '14px',
            borderTop: `1px solid ${theme.divider}`,
            paddingTop: '10px',
            fontSize: '10px',
            color: theme.muted,
            maxWidth: '210px',
            lineHeight: 1.4,
          }}
        >
          <div style={{ textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Routing
          </div>
          <div>
            {routeLayerMode === 'city' &&
              'City view: aggregated corridors radiate from auth gate to service districts.'}
            {routeLayerMode === 'debug' &&
              'Debug view: individual endpoint edges for detailed inspection.'}
            {routeLayerMode === 'both' &&
              'Combined view: city corridors overlaid with endpoint debug edges.'}
          </div>
          <div style={{ marginTop: '4px' }}>Switch to Endpoint Debug for per-endpoint detail.</div>
        </div>
      </div>
    </div>
  );
}
