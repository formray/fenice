import { useEffect } from 'react';
import { useAgentStore } from '../stores/agent.store';
import { AgentEntity } from './AgentEntity';

/**
 * Renders all currently connected MCP agents in the cosmos.
 * Subscribes to the agent store and prunes expired beams on a render tick.
 */
export function AgentSwarm(): React.JSX.Element {
  const agents = useAgentStore((s) => s.agents);
  const pruneBeams = useAgentStore((s) => s.pruneBeams);

  useEffect(() => {
    const id = setInterval(() => {
      pruneBeams(Date.now());
    }, 250);
    return () => {
      clearInterval(id);
    };
  }, [pruneBeams]);

  return (
    <>
      {Object.values(agents).map((agent) => (
        <AgentEntity key={agent.id} agent={agent} />
      ))}
    </>
  );
}
