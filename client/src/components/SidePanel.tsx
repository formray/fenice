import { useMemo } from 'react';
import { useSelectionStore } from '../stores/selection.store';
import { useWorldStore } from '../stores/world.store';
import { useViewStore } from '../stores/view.store';
import { METHOD_COLORS, METHOD_LABELS, LINK_STATE_COLORS } from '../utils/colors';
import type { WorldEndpoint } from '../types/world';

const PANEL_THEME = {
  dark: {
    bg: 'rgba(10, 10, 20, 0.95)',
    border: '#2a2a3e',
    text: '#e0e0e0',
    muted: '#888',
    subtle: '#bbb',
    path: '#fff',
    chipBg: 'rgba(255,255,255,0.05)',
    chipBorder: '#2a2a3e',
    close: '#888',
  },
  light: {
    bg: 'rgba(245, 249, 255, 0.96)',
    border: '#b8c8e8',
    text: '#1f2f4f',
    muted: '#4f6187',
    subtle: '#2f436d',
    path: '#102347',
    chipBg: 'rgba(35,70,130,0.06)',
    chipBorder: '#afc2e8',
    close: '#5b6e98',
  },
} as const;

export function SidePanel(): React.JSX.Element | null {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const setSelected = useSelectionStore((s) => s.setSelected);
  const endpoints = useWorldStore((s) => s.endpoints);
  const services = useWorldStore((s) => s.services);
  const edges = useWorldStore((s) => s.edges);
  const endpointSemantics = useWorldStore((s) => s.endpointSemantics);
  const endpointOverlays = useWorldStore((s) => s.endpointOverlays);
  const visualMode = useViewStore((s) => s.visualMode);
  const theme = PANEL_THEME[visualMode];

  const endpointMap = useMemo(() => new Map(endpoints.map((e) => [e.id, e])), [endpoints]);

  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const endpoint = selectedId ? endpointMap.get(selectedId) : undefined;
  if (!endpoint) return null;

  const semantics = endpointSemantics[endpoint.id];
  const overlay = endpointOverlays[endpoint.id];

  const service = serviceMap.get(endpoint.serviceId);
  const methodColor = METHOD_COLORS[endpoint.method];
  const methodLabel = METHOD_LABELS[endpoint.method];

  // Find related endpoints via edges
  const relatedIds = new Set<string>();
  for (const edge of edges) {
    if (edge.sourceId === endpoint.id) relatedIds.add(edge.targetId);
    if (edge.targetId === endpoint.id) relatedIds.add(edge.sourceId);
  }
  const relatedEndpoints: WorldEndpoint[] = [];
  for (const id of relatedIds) {
    const ep = endpointMap.get(id);
    if (ep) relatedEndpoints.push(ep);
  }

  const handleRelatedClick = (id: string): void => {
    setSelected(id);
  };

  const handleClose = (): void => {
    setSelected(null);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '340px',
        height: '100%',
        backgroundColor: theme.bg,
        borderLeft: `1px solid ${theme.border}`,
        padding: '20px',
        overflowY: 'auto',
        color: theme.text,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        boxSizing: 'border-box',
      }}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'none',
          border: 'none',
          color: theme.close,
          fontSize: '20px',
          cursor: 'pointer',
          padding: '4px 8px',
          lineHeight: 1,
        }}
        aria-label="Close panel"
      >
        ×
      </button>

      {/* Service tag */}
      {service && (
        <div
          style={{
            fontSize: '12px',
            color: theme.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px',
          }}
        >
          {service.tag}
        </div>
      )}

      {/* Method badge */}
      <div style={{ marginBottom: '12px' }}>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: methodColor,
            color: '#fff',
            fontWeight: 700,
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '3px',
            letterSpacing: '0.5px',
          }}
        >
          {methodLabel}
        </span>
      </div>

      {/* Path */}
      <div
        style={{
          fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace',
          fontSize: '15px',
          color: theme.path,
          wordBreak: 'break-all',
          marginBottom: '16px',
          lineHeight: 1.4,
        }}
      >
        {endpoint.path}
      </div>

      {/* Summary */}
      {endpoint.summary && (
        <div style={{ marginBottom: '16px', color: theme.subtle, lineHeight: 1.5 }}>
          {endpoint.summary}
        </div>
      )}

      {/* Metadata */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '8px 12px',
          marginBottom: '20px',
          fontSize: '13px',
        }}
      >
        <span style={{ color: theme.muted }}>Auth required</span>
        <span style={{ color: endpoint.hasAuth ? '#ffd700' : '#50c878' }}>
          {endpoint.hasAuth ? 'Yes' : 'No'}
        </span>

        <span style={{ color: theme.muted }}>Parameters</span>
        <span>{endpoint.parameterCount}</span>
      </div>

      {/* Semantic state */}
      {semantics && (
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '12px',
              color: theme.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            Semantic State
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '8px 12px',
              fontSize: '13px',
            }}
          >
            <span style={{ color: theme.muted }}>Link state</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: LINK_STATE_COLORS[semantics.linkState].hex,
                  display: 'inline-block',
                }}
              />
              {semantics.linkState}
            </span>

            {semantics.reason && (
              <>
                <span style={{ color: theme.muted }}>Reason</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {semantics.reason}
                </span>
              </>
            )}

            <span style={{ color: theme.muted }}>Zone</span>
            <span>{semantics.zone}</span>

            {overlay?.health && (
              <>
                <span style={{ color: theme.muted }}>Health</span>
                <span>{overlay.health.status}</span>
              </>
            )}

            {overlay?.metrics && (
              <>
                <span style={{ color: theme.muted }}>p95</span>
                <span>{overlay.metrics.p95.toFixed(0)}ms</span>
                <span style={{ color: theme.muted }}>Error rate</span>
                <span>{(overlay.metrics.errorRate * 100).toFixed(1)}%</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Related endpoints */}
      {relatedEndpoints.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '12px',
              color: theme.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            Related Endpoints
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {relatedEndpoints.map((ep) => (
              <button
                key={ep.id}
                onClick={() => handleRelatedClick(ep.id)}
                style={{
                  background: theme.chipBg,
                  border: `1px solid ${theme.chipBorder}`,
                  borderRadius: '4px',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: theme.subtle,
                  fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  style={{
                    backgroundColor: METHOD_COLORS[ep.method],
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '9px',
                    padding: '2px 5px',
                    borderRadius: '2px',
                    flexShrink: 0,
                  }}
                >
                  {METHOD_LABELS[ep.method]}
                </span>
                <span
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {ep.path}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
