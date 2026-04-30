import { useAgentStore } from '../stores/agent.store';
import { ROLE_COLORS } from '../types/agent';

/**
 * HUD panel showing connected MCP agents and the most recent activity.
 * Sized small so it doesn't compete with the main HUD.
 */
export function AgentPanel(): React.JSX.Element | null {
  const agents = useAgentStore((s) => s.agents);
  const feed = useAgentStore((s) => s.feed);

  const list = Object.values(agents);
  if (list.length === 0 && feed.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: 280,
        padding: '12px 14px',
        background: 'rgba(8, 14, 28, 0.85)',
        border: '1px solid rgba(0, 245, 255, 0.25)',
        borderRadius: 6,
        backdropFilter: 'blur(6px)',
        color: '#cbe6ff',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
        lineHeight: 1.5,
        zIndex: 10,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: '#5eaadd',
          marginBottom: 8,
        }}
      >
        Agents · {list.length} connected
      </div>

      {list.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 10px' }}>
          {list.map((agent) => (
            <li
              key={agent.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: ROLE_COLORS[agent.role],
                  boxShadow: `0 0 6px ${ROLE_COLORS[agent.role]}`,
                }}
              />
              <span style={{ color: '#fff' }}>{agent.name}</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span style={{ opacity: 0.6 }}>{agent.role}</span>
              {agent.status === 'busy' && agent.currentTool && (
                <span style={{ marginLeft: 'auto', color: '#ffaa44', opacity: 0.85 }}>
                  {agent.currentTool}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {feed.length > 0 && (
        <>
          <div
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: '#5eaadd',
              marginBottom: 6,
              borderTop: '1px solid rgba(94, 170, 221, 0.2)',
              paddingTop: 8,
            }}
          >
            Activity
          </div>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              maxHeight: 140,
              overflowY: 'auto',
            }}
          >
            {feed.slice(0, 8).map((entry) => {
              const statusColor =
                entry.status === 'failed'
                  ? '#ff5544'
                  : entry.status === 'completed'
                    ? '#55ff88'
                    : '#ffaa44';
              return (
                <li
                  key={entry.id}
                  style={{
                    display: 'flex',
                    gap: 6,
                    padding: '2px 0',
                    fontSize: 10,
                    opacity: 0.85,
                  }}
                >
                  <span style={{ color: ROLE_COLORS[entry.agentRole], width: 60, flexShrink: 0 }}>
                    {entry.agentName.slice(0, 8)}
                  </span>
                  <span style={{ flex: 1 }}>{entry.tool}</span>
                  <span style={{ color: statusColor }}>{entry.status}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
