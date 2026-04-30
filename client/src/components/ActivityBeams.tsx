import { useMemo } from 'react';
import { useAgentStore } from '../stores/agent.store';
import { useWorldStore } from '../stores/world.store';
import { computeCosmosLayout, type CosmosPosition } from '../services/cosmos-layout.service';
import { ActivityBeam } from './ActivityBeam';

/**
 * Renders all active agent → planet beams. Looks up target world positions
 * from the cosmos layout (memoized per render) so individual beams don't
 * recompute the layout.
 */
export function ActivityBeams(): React.JSX.Element {
  const beams = useAgentStore((s) => s.beams);
  const services = useWorldStore((s) => s.services);
  const endpoints = useWorldStore((s) => s.endpoints);

  const targetPositions = useMemo(() => {
    if (services.length === 0) return new Map<string, CosmosPosition>();
    const layout = computeCosmosLayout(services, endpoints);
    const map = new Map<string, CosmosPosition>();
    // Service stars by id
    for (const star of layout.stars) {
      map.set(star.serviceId, star.position);
    }
    // Endpoints — point at the parent star (planets orbit dynamically;
    // good-enough approximation given the beam lifetime is 2.5s).
    for (const ep of endpoints) {
      const star = layout.stars.find((s) => s.serviceId === ep.serviceId);
      if (star) map.set(ep.id, star.position);
    }
    return map;
  }, [services, endpoints]);

  return (
    <>
      {beams.map((beam) => {
        const target = targetPositions.get(beam.target.id);
        if (!target) return null;
        return <ActivityBeam key={beam.id} beam={beam} targetPosition={target} />;
      })}
    </>
  );
}
