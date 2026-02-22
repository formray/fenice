import { useMemo } from 'react';
import { useWorldStore } from '../stores/world.store';
import { computeCityLayout } from '../services/layout.service';
import { Building } from './Building';
import { Edges } from './Edges';
import { District } from './District';
import { AuthGate } from './AuthGate';
import { RingRoads } from './RingRoads';
import { Boulevards } from './Boulevards';

export function City(): React.JSX.Element | null {
  const services = useWorldStore((s) => s.services);
  const endpoints = useWorldStore((s) => s.endpoints);
  const edges = useWorldStore((s) => s.edges);
  const endpointSemantics = useWorldStore((s) => s.endpointSemantics);

  const layout = useMemo(() => computeCityLayout(services, endpoints), [services, endpoints]);

  const endpointMap = useMemo(() => new Map(endpoints.map((e) => [e.id, e])), [endpoints]);

  if (endpoints.length === 0) return null;

  return (
    <group>
      <RingRoads roads={layout.ringRoads} />
      <Boulevards boulevards={layout.boulevards} />
      <AuthGate position={layout.gatePosition} />
      {layout.districts.map((d) => (
        <District key={d.serviceId} layout={d} />
      ))}
      {layout.buildings.map((b) => {
        const endpoint = endpointMap.get(b.endpointId);
        if (!endpoint) return null;
        return <Building key={b.endpointId} layout={b} endpoint={endpoint} />;
      })}
      <Edges
        edges={edges}
        buildingLayouts={layout.buildings}
        endpointSemantics={endpointSemantics}
        endpointMap={endpointMap}
        gatePosition={layout.gatePosition}
      />
    </group>
  );
}
