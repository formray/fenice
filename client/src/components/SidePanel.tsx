import { useMemo } from 'react';
import { useSelectionStore } from '../stores/selection.store';
import { useWorldStore } from '../stores/world.store';
import { METHOD_COLORS, METHOD_LABELS } from '../utils/colors';
import type { WorldEndpoint } from '../types/world';

export function SidePanel(): React.JSX.Element | null {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const setSelected = useSelectionStore((s) => s.setSelected);
  const endpoints = useWorldStore((s) => s.endpoints);
  const services = useWorldStore((s) => s.services);
  const edges = useWorldStore((s) => s.edges);

  const endpointMap = useMemo(() => new Map(endpoints.map((e) => [e.id, e])), [endpoints]);

  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const endpoint = selectedId ? endpointMap.get(selectedId) : undefined;
  if (!endpoint) return null;

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
        backgroundColor: 'rgba(10, 10, 20, 0.95)',
        borderLeft: '1px solid #2a2a3e',
        padding: '20px',
        overflowY: 'auto',
        color: '#e0e0e0',
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
          color: '#888',
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
            color: '#888',
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
          color: '#fff',
          wordBreak: 'break-all',
          marginBottom: '16px',
          lineHeight: 1.4,
        }}
      >
        {endpoint.path}
      </div>

      {/* Summary */}
      {endpoint.summary && (
        <div style={{ marginBottom: '16px', color: '#bbb', lineHeight: 1.5 }}>
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
        <span style={{ color: '#888' }}>Auth required</span>
        <span style={{ color: endpoint.hasAuth ? '#ffd700' : '#50c878' }}>
          {endpoint.hasAuth ? 'Yes' : 'No'}
        </span>

        <span style={{ color: '#888' }}>Parameters</span>
        <span>{endpoint.parameterCount}</span>
      </div>

      {/* Related endpoints */}
      {relatedEndpoints.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '12px',
              color: '#888',
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
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #2a2a3e',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: '#ccc',
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
