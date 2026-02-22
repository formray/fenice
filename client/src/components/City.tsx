import { useMemo } from 'react';
import { useWorldStore } from '../stores/world.store';
import { computeCityLayout } from '../services/layout.service';
import { Building } from './Building';
import { Edges } from './Edges';
import { District } from './District';

export function City(): React.JSX.Element | null {
  const services = useWorldStore((s) => s.services);
  const endpoints = useWorldStore((s) => s.endpoints);
  const edges = useWorldStore((s) => s.edges);
  const loading = useWorldStore((s) => s.loading);

  const layout = useMemo(() => computeCityLayout(services, endpoints), [services, endpoints]);

  if (loading || endpoints.length === 0) return null;

  // Build a lookup map for endpoints
  const endpointMap = useMemo(() => new Map(endpoints.map((e) => [e.id, e])), [endpoints]);

  return (
    <group>
      {layout.districts.map((d) => (
        <District key={d.serviceId} layout={d} />
      ))}
      {layout.buildings.map((b) => {
        const endpoint = endpointMap.get(b.endpointId);
        if (!endpoint) return null;
        return <Building key={b.endpointId} layout={b} endpoint={endpoint} />;
      })}
      <Edges edges={edges} buildingLayouts={layout.buildings} />
    </group>
  );
}
